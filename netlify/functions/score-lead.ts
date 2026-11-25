// POST /api/score-lead  { lead_id }
// AI Lead Scoring. Loads the lead and its engagement history from the
// database (as the user, under RLS), asks Gemini for a structured estimate,
// normalises it, and stores it in lead_scores + on the lead.
import { SCORE_THRESHOLDS } from '../../shared/constants';
import { scoreAiSchema, scoreRequestSchema } from '../../shared/schemas';
import { leadCompleteness, normalizeScore } from '../../shared/scoring';
import type { Lead } from '../../shared/types';
import { dataBlock, generateJson, SHARED_RULES } from '../lib/gemini';
import { createHandler } from '../lib/handler';
import { HttpError } from '../lib/http';
import { scoreSchema } from '../lib/responseSchemas';

const SYSTEM = `You are a B2B sales qualification analyst. Estimate how promising a lead is for the seller, from 0 to 100.

Score each factor 0–10 using ONLY the data provided:
- industry_relevance: how well the lead's industry matches the seller's target customers
- company_size: whether company size fits the seller's offering
- requirements: how clearly the lead's stated requirements match what the seller provides
- budget_indicators: evidence of budget/authority to spend (unknown = low-middle, not zero)
- decision_maker_relevance: seniority/role relevance of the contact for this purchase
- product_fit: overall fit between the lead's needs and the seller's product
- engagement: based on the engagement signals (stage, contact history, activities). No history = low.

Overall score: weigh the factors sensibly (product_fit, requirements and decision_maker_relevance matter most). Hot ≥ ${SCORE_THRESHOLDS.hot}, Warm ${SCORE_THRESHOLDS.warm}–${SCORE_THRESHOLDS.hot - 1}, Cold < ${SCORE_THRESHOLDS.warm}.
When data is sparse, do not guess high: keep factors near the middle or low, set data_completeness accordingly and list missing information under risk_factors.
This is an estimate of fit and priority, NOT a probability of closing — do not express it as a probability.
positive_indicators and risk_factors must each reference concrete data points.
next_action: one specific, practical next step for the seller.
${SHARED_RULES}`;

export default createHandler('score-lead', { schema: scoreRequestSchema }, async ({ lead_id }, { supabase, user }) => {
  const { data: lead, error } = await supabase.from('leads').select('*').eq('id', lead_id).maybeSingle();
  if (error || !lead) throw new HttpError(404, 'NOT_FOUND', 'Lead not found.');
  const l = lead as Lead;

  const [profile, activities, followups, emails] = await Promise.all([
    supabase.from('profiles').select('company_name,product_name,product_description,target_customer,value_proposition').eq('id', user.id).maybeSingle(),
    supabase.from('sales_activities').select('type,description,created_at').eq('lead_id', lead_id).order('created_at', { ascending: false }).limit(25),
    supabase.from('followups').select('status,due_at,completed_at,channel').eq('lead_id', lead_id).limit(50),
    supabase.from('generated_emails').select('id', { count: 'exact', head: true }).eq('lead_id', lead_id),
  ]);

  const acts = activities.data ?? [];
  const fups = followups.data ?? [];
  const engagement = {
    pipeline_stage: l.status,
    days_since_created: Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86_400_000),
    last_contacted: l.last_contacted_at?.slice(0, 10) ?? 'never',
    calls_logged: acts.filter((a) => a.type === 'call').length,
    meetings_logged: acts.filter((a) => a.type === 'meeting').length,
    emails_marked_sent: acts.filter((a) => a.type === 'email_sent').length,
    emails_drafted: emails.count ?? 0,
    followups_completed: fups.filter((f) => f.status === 'completed').length,
    followups_pending: fups.filter((f) => f.status === 'pending').length,
    recent_notes: acts.filter((a) => a.type === 'note' || a.type === 'call' || a.type === 'meeting').slice(0, 5).map((a) => a.description),
  };

  const prompt = [
    dataBlock('seller', profile.data ?? { note: 'Seller has not described their product yet — judge fit cautiously.' }),
    dataBlock('lead', {
      contact_name: l.contact_name,
      job_title: l.job_title,
      company: l.company,
      website: l.website,
      industry: l.industry,
      company_size: l.company_size,
      location: l.location,
      source: l.source,
      budget: l.budget,
      requirements: l.requirements,
      notes: l.notes,
      deal_value: l.deal_value,
      research_summary: l.research ? { overview: l.research.company_overview, needs: l.research.customer_needs } : null,
    }),
    dataBlock('engagement_signals', engagement),
    `Data completeness (share of optional fields filled): ${Math.round(leadCompleteness(l as unknown as Record<string, unknown>) * 100)}%.`,
    'Return the score JSON.',
  ].join('\n\n');

  const { data, model } = await generateJson({ system: SYSTEM, prompt, schema: scoreSchema, validator: scoreAiSchema, temperature: 0.2, maxOutputTokens: 2048 });
  const result = normalizeScore(data);

  const { data: saved, error: saveErr } = await supabase
    .from('lead_scores')
    .insert({
      lead_id,
      score: result.score,
      label: result.label,
      explanation: result.explanation,
      factors: result.factors,
      positive_indicators: result.positive_indicators,
      risk_factors: result.risk_factors,
      next_action: result.next_action,
      data_completeness: result.data_completeness,
      model,
    })
    .select('*')
    .single();
  if (saveErr) {
    console.error('[score-lead] save failed', saveErr.message);
    throw new HttpError(500, 'INTERNAL', 'The score was generated but could not be saved. Please try again.');
  }
  await supabase.from('leads').update({ score: result.score, score_label: result.label, scored_at: new Date().toISOString() }).eq('id', lead_id);
  await supabase.from('sales_activities').insert({
    lead_id,
    type: 'lead_scored',
    description: `AI score estimate: ${result.score}/100 (${result.label})`,
    metadata: { score: result.score, label: result.label, model },
  });

  return { result, score: saved, model };
});
