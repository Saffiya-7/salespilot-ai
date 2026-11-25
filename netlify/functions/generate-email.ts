// POST /api/generate-email
// AI Cold Email Generator: generate, 3 variants, rewrite, shorten, improve personalisation.
// Drafts are stored in generated_emails (unsaved until the user saves them).
// Nothing is ever sent from here.
import { emailAiSchema, emailRequestSchema } from '../../shared/schemas';
import type { Lead } from '../../shared/types';
import { dataBlock, generateJson, SHARED_RULES } from '../lib/gemini';
import { createHandler } from '../lib/handler';
import { HttpError } from '../lib/http';
import { emailSchema } from '../lib/responseSchemas';
import { TONE_GUIDE } from '../lib/tones';

const ACTION_GUIDE = {
  generate: 'Write ONE cold e-mail.',
  variants: 'Write THREE clearly different versions: (1) pain-point led, (2) outcome/ROI led, (3) curiosity or question led. Different subject lines and openings.',
  rewrite: 'Rewrite the <existing_email> with fresh wording and structure. Keep its facts; do not add new claims. Return ONE e-mail.',
  shorten: 'Shorten the <existing_email> to under 90 words while keeping the core value and the call to action. Return ONE e-mail.',
  personalize:
    'Improve personalisation of the <existing_email> using ONLY facts in <prospect> and <lead_record>. Where a specific detail would help but is unknown, insert a clearly bracketed placeholder such as [recent project] for the sender to fill in. Return ONE e-mail.',
} as const;

const SYSTEM = `You are an expert B2B copywriter who writes cold e-mails that get replies.
Principles: lead with the prospect's situation, one clear problem, one specific value proposition, one low-friction call to action. No buzzwords, no exaggerated claims, no fake familiarity ("Hope you're well" is fine; "Loved your recent post" is NOT unless provided).
Never invent facts about the prospect or their company (news, funding, posts, metrics, mutual connections, events). Personalise only with the facts provided.
Never invent statistics or customer results for the seller either; if proof is not provided, don't fabricate it.
Sign off with the placeholder [Your name]. The "body" must be the full ready-to-send text including greeting and sign-off.
${SHARED_RULES}`;

export default createHandler('generate-email', { schema: emailRequestSchema }, async (input, { supabase }) => {
  let lead: Lead | null = null;
  if (input.lead_id) {
    const { data } = await supabase.from('leads').select('*').eq('id', input.lead_id).maybeSingle();
    if (!data) throw new HttpError(404, 'NOT_FOUND', 'Lead not found.');
    lead = data as Lead;
  }

  const prompt = [
    `Task: ${ACTION_GUIDE[input.action]}`,
    `Tone: ${input.tone} — ${TONE_GUIDE[input.tone]}.`,
    dataBlock('prospect', {
      name: input.prospect_name,
      company: input.company,
      industry: input.industry ?? null,
      pain_points: input.pain_points ?? null,
    }),
    dataBlock('seller_offer', { product_or_service: input.product, key_benefits: input.benefits ?? null }),
    lead
      ? dataBlock('lead_record', {
          job_title: lead.job_title,
          company_size: lead.company_size,
          location: lead.location,
          requirements: lead.requirements,
          notes: lead.notes,
          research_overview: lead.research?.company_overview ?? null,
          research_outreach_angle: lead.research?.outreach_angle ?? null,
          verified_facts: lead.research?.verified_information?.map((v) => v.statement) ?? [],
        })
      : '',
    input.existing ? dataBlock('existing_email', `Subject: ${input.existing.subject}\n\n${input.existing.body}`) : '',
    input.instructions ? dataBlock('extra_instructions_from_sender', input.instructions) : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const { data, model } = await generateJson({
    system: SYSTEM,
    prompt,
    schema: emailSchema,
    validator: emailAiSchema,
    temperature: input.action === 'variants' ? 0.85 : 0.6,
    maxOutputTokens: input.action === 'variants' ? 5000 : 2500,
  });

  const wanted = input.action === 'variants' ? 3 : 1;
  const emails = data.emails.slice(0, wanted);
  if (input.action === 'variants' && emails.length < 2) {
    throw new HttpError(502, 'AI_INVALID_RESPONSE', 'The AI returned fewer alternatives than expected. Please try again.');
  }

  const rows = emails.map((e) => ({
    lead_id: input.lead_id ?? null,
    kind: 'cold',
    action: input.action,
    tone: input.tone,
    prospect_name: input.prospect_name,
    company: input.company,
    subject: e.subject,
    opening: e.opening,
    problem_statement: e.problem_statement,
    value_proposition: e.value_proposition,
    cta: e.cta,
    body: e.body,
    is_saved: false,
    input: { industry: input.industry, product: input.product, benefits: input.benefits, pain_points: input.pain_points },
    model,
  }));
  const { data: records, error } = await supabase.from('generated_emails').insert(rows).select('*');
  if (error) console.warn('[generate-email] could not store drafts', error.message);

  if (input.lead_id) {
    await supabase.from('sales_activities').insert({
      lead_id: input.lead_id,
      type: 'email_generated',
      description: `AI drafted ${emails.length === 1 ? 'an e-mail' : `${emails.length} e-mail versions`} (${input.tone}, ${input.action})`,
      metadata: { action: input.action, tone: input.tone },
    });
  }

  return {
    emails: emails.map((e, i) => ({ ...e, id: records?.[i]?.id ?? null })),
    records: records ?? [],
    model,
  };
});
