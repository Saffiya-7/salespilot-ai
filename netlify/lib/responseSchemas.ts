// Gemini structured-output schemas (OpenAPI subset). Each one mirrors a Zod
// schema in shared/schemas.ts; the Zod schema re-validates every response.
import { Type, type Schema } from '@google/genai';
import { SCORE_FACTORS } from '../../shared/constants';

const S = (description?: string): Schema => ({ type: Type.STRING, ...(description ? { description } : {}) });
const list = (description: string, maxItems = 6): Schema => ({
  type: Type.ARRAY,
  description,
  items: { type: Type.STRING },
  maxItems: String(maxItems),
});
const obj = (properties: Record<string, Schema>, description?: string): Schema => ({
  type: Type.OBJECT,
  properties,
  required: Object.keys(properties),
  propertyOrdering: Object.keys(properties),
  ...(description ? { description } : {}),
});

export const researchSchema: Schema = obj({
  company_overview: S('2–4 sentence overview. Only state facts that appear in the provided input or search results; otherwise phrase as likely/possibly.'),
  industry_classification: obj({
    primary: S('Primary industry'),
    sub_industry: S('More specific sub-industry or niche; empty string if unclear'),
    confidence: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
  }),
  likely_challenges: list('Business challenges this company likely faces (hypotheses)', 5),
  customer_needs: list('Needs this company likely has that relate to the seller’s offering', 5),
  product_use_cases: list('Concrete ways the seller’s product could help this company', 5),
  value_proposition: S('Tailored value proposition from the seller to this company'),
  sales_approach: S('Recommended sales approach: who to target, how, and in what order'),
  outreach_angle: S('One sharp outreach angle / hook for the first message'),
  verified_information: {
    type: Type.ARRAY,
    description: 'Only facts copied from the provided input (basis user_input) or from the numbered search results (basis web, with that result URL). Never add facts from memory.',
    items: obj({
      statement: S(),
      basis: { type: Type.STRING, enum: ['user_input', 'web'] },
      source_url: { type: Type.STRING, nullable: true, description: 'URL of the search result for basis web; null for user_input' },
    }),
    maxItems: '12',
  },
  ai_hypotheses: list('Assumptions and inferences you made that are NOT verified', 8),
  information_gaps: list('Questions the seller should verify before or during outreach', 5),
});

export const scoreSchema: Schema = obj({
  score: { type: Type.INTEGER, description: 'Overall fit/priority estimate 0–100' },
  explanation: S('3–5 sentences explaining the estimate and its main drivers'),
  factors: obj(
    Object.fromEntries(
      SCORE_FACTORS.map((f) => [
        f.key,
        obj({ score: { type: Type.INTEGER, description: `${f.label} 0–10` }, reason: S('One short sentence') }),
      ]),
    ),
  ),
  positive_indicators: list('Signals that raise the score, grounded in the lead data', 5),
  risk_factors: list('Signals that lower the score or missing information', 5),
  next_action: S('One specific recommended next action for the seller'),
  data_completeness: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
});

const emailDraft: Schema = obj({
  subject: S('Subject line, under 70 characters, no clickbait'),
  opening: S('Personalised opening line(s) based ONLY on the provided facts'),
  problem_statement: S('The problem or pain point being addressed'),
  value_proposition: S('How the product helps, specific to this prospect'),
  cta: S('One clear, low-friction call to action'),
  body: S('The complete e-mail body ready to send, including greeting and sign-off placeholder [Your name]'),
});

export const emailSchema: Schema = obj({
  emails: { type: Type.ARRAY, items: emailDraft, minItems: '1', maxItems: '3' },
});

export const followupSchema: Schema = obj({
  subject: S('Subject line (for e-mail) or a short title'),
  body: S('The full follow-up message'),
  channel: { type: Type.STRING, enum: ['email', 'call', 'linkedin', 'meeting', 'other'] },
  recommended_days_from_now: { type: Type.INTEGER, description: 'When to send this, in days from today (0–30)' },
  timing_reason: S('Why this timing'),
  talking_points: list('Key points to make', 4),
});

export const assistantSchema: Schema = obj({
  answer: S('Answer in concise Markdown (short paragraphs, bullet lists, **bold**). Only use numbers present in ACCOUNT DATA.'),
  referenced_lead_ids: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'ids of leads mentioned in the answer' },
  suggested_actions: list('Up to 3 short next actions', 3),
});

export const insightsSchema: Schema = obj({
  summary: S('2–3 sentence summary of the account’s sales situation, using only the provided metrics'),
  insights: {
    type: Type.ARRAY,
    maxItems: '6',
    items: obj({
      title: S('Short headline'),
      detail: S('1–3 sentences; cite the metric(s) it is based on'),
      type: { type: Type.STRING, enum: ['opportunity', 'risk', 'action'] },
      priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
    }),
  },
  recommendations: list('Concrete recommendations to improve conversion', 5),
});
