// POST /api/research-company
// AI Lead Research. Analyses the user's input (and, only if a live search
// provider is configured, real search results) and keeps verified facts
// separate from AI hypotheses.
import { researchRequestSchema, researchAiSchema } from '../../shared/schemas';
import { sanitizeResearch } from '../../shared/research';
import { dataBlock, generateJson, SHARED_RULES } from '../lib/gemini';
import { createHandler } from '../lib/handler';
import { HttpError } from '../lib/http';
import { researchSchema } from '../lib/responseSchemas';
import { liveSearch, toSources } from '../lib/search';

const SYSTEM = `You are a senior B2B sales researcher. You prepare account research that a salesperson will use before contacting a company.

Separate knowledge strictly:
- "verified_information": ONLY statements that are directly stated in <seller_input>/<company_input> (basis "user_input", source_url null) or in a numbered <search_results> item (basis "web", source_url = that item's URL). Copy facts faithfully; do not embellish.
- Everything you infer (challenges, needs, size, tech stack, priorities) is a hypothesis. Put key assumptions in "ai_hypotheses" and use hedged language ("likely", "may") in the narrative sections.
- Never claim you visited the website or searched online unless <search_results> are provided.
- "information_gaps": the most valuable things the seller should confirm.
Tailor use cases, value proposition, sales approach and outreach angle to the seller's product.
${SHARED_RULES}`;

export default createHandler('research-company', { schema: researchRequestSchema }, async (input, { supabase, user }) => {

  // Fill seller context from the profile when the form left it blank.
  const { data: profile } = await supabase.from('profiles').select('product_name,product_description,target_customer,value_proposition,company_name').eq('id', user.id).maybeSingle();
  const product = input.product ?? [profile?.product_name, profile?.product_description].filter(Boolean).join(' — ');
  const targetCustomer = input.target_customer ?? profile?.target_customer ?? undefined;

  if (input.lead_id) {
    const { data: lead } = await supabase.from('leads').select('id').eq('id', input.lead_id).maybeSingle();
    if (!lead) throw new HttpError(404, 'NOT_FOUND', 'Lead not found.');
  }

  const findings = input.use_live_search
    ? await liveSearch([input.company_name, input.website].filter(Boolean).join(' '))
    : null;
  const mode = findings && findings.results.length > 0 ? 'live_search' : 'input_only';

  const prompt = [
    dataBlock('company_input', {
      company_name: input.company_name,
      website: input.website ?? null,
      industry: input.industry ?? null,
      description: input.description ?? null,
    }),
    dataBlock('seller_input', {
      seller_company: profile?.company_name ?? null,
      product_or_service: product || null,
      target_customer_profile: targetCustomer ?? null,
      value_proposition: profile?.value_proposition ?? null,
    }),
    mode === 'live_search'
      ? dataBlock(
          'search_results',
          findings!.results.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`).join('\n\n'),
        )
      : 'No web search was performed. Base everything on the input above and general industry knowledge, clearly marked as hypotheses. verified_information must only contain basis "user_input" items.',
    'Produce the account research JSON.',
  ].join('\n\n');

  const { data, model } = await generateJson({
    system: SYSTEM,
    prompt,
    schema: researchSchema,
    validator: researchAiSchema,
    temperature: 0.35,
    maxOutputTokens: 4096,
  });

  const research = sanitizeResearch(data, { mode, sources: toSources(findings), model });

  let savedToLead = false;
  if (input.lead_id) {
    const { error } = await supabase.from('leads').update({ research, researched_at: research.generated_at }).eq('id', input.lead_id);
    if (!error) {
      savedToLead = true;
      await supabase.from('sales_activities').insert({
        lead_id: input.lead_id,
        type: 'research_completed',
        description: `AI research completed for ${input.company_name}${mode === 'live_search' ? ' (with live search)' : ' (from your input)'}`,
        metadata: { mode, model },
      });
    }
  }

  return { research, saved_to_lead: savedToLead };
});
