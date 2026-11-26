// POST /api/generate-insights  { scope: 'dashboard' | 'analytics' }
// AI insights and recommendations computed from the user's real metrics.
// With no leads, it returns an honest empty result without calling the AI.
import { insightsAiSchema, insightsRequestSchema } from '../../shared/schemas';
import { cleanList } from '../../shared/scoring';
import type { InsightsResult } from '../../shared/types';
import { buildSnapshot, loadAccountData } from '../lib/accountData';
import { dataBlock, generateJson, SHARED_RULES } from '../lib/gemini';
import { createHandler } from '../lib/handler';
import { insightsSchema } from '../lib/responseSchemas';

const SYSTEM = `You are a sales operations analyst. From the ACCOUNT DATA metrics, produce actionable insights for a small B2B sales team.
- Every insight must be grounded in specific numbers from the data, quoted exactly. Do not invent benchmarks or industry averages.
- Mention sample size when it is small (e.g. "only 3 closed deals so far") and avoid strong conclusions from tiny samples.
- Prioritise: overdue follow-ups, hot leads not yet progressed, stalled deals, best/worst performing industries and sources, scoring coverage.
- Recommendations must be concrete actions the user can take in Sumo this week.
${SHARED_RULES}`;

export const EMPTY_INSIGHTS = (): InsightsResult => ({
  summary: 'There is no lead data yet, so there is nothing to analyse. Add or import leads to unlock AI insights.',
  insights: [],
  recommendations: [
    'Add your first leads or import a CSV',
    'Describe your product in Settings so the AI can judge fit',
    'Score your leads to see who to prioritise',
  ],
  generated_at: new Date().toISOString(),
  based_on: { total_leads: 0, activities: 0, followups: 0 },
});

export default createHandler('generate-insights', { schema: insightsRequestSchema }, async (input, { supabase, user }) => {
  const account = await loadAccountData(supabase, user.id);
  if (account.leads.length === 0) return EMPTY_INSIGHTS();

  const snapshot = buildSnapshot(account);
  const prompt = [
    `Scope: ${input.scope === 'analytics' ? 'a detailed analytics review (conversion, industries, sources, pipeline, follow-up discipline)' : 'a short daily dashboard briefing'}.`,
    dataBlock('account_data', { ...snapshot, leads: snapshot.leads.slice(0, 40) }),
    'Return the insights JSON (3–6 insights).',
  ].join('\n\n');

  const { data } = await generateJson({
    system: SYSTEM,
    prompt,
    schema: insightsSchema,
    validator: insightsAiSchema,
    temperature: 0.3,
    maxOutputTokens: 2500,
  });

  const result: InsightsResult = {
    summary: data.summary,
    insights: data.insights.slice(0, 6),
    recommendations: cleanList(data.recommendations, 5),
    generated_at: new Date().toISOString(),
    based_on: { total_leads: account.leads.length, activities: account.activities.length, followups: account.followups.length },
  };
  return result;
});
