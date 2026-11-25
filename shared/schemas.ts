// Zod schemas shared by the browser (form validation) and the Netlify
// Functions (request validation + AI response validation).
import { z } from 'zod';
import {
  COMPANY_SIZES,
  EMAIL_ACTIONS,
  EMAIL_TONES,
  FOLLOWUP_CHANNELS,
  LEAD_SOURCES,
  LIMITS,
  PIPELINE_STAGES,
  SCORE_LABELS,
} from './constants';

const text = (max: number) => z.string().trim().max(max, `Must be ${max} characters or fewer`);
/** Optional text: missing, null and blank all become undefined. */
const optText = (max: number) =>
  z
    .preprocess(
      (v) => (typeof v === 'string' ? v.trim() || undefined : v === null ? undefined : v),
      z.string().max(max, `Must be ${max} characters or fewer`).optional(),
    )
    .optional();
const required = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);
const uuid = z.uuid({ error: 'Invalid id' });

/** Accepts "acme.com", "www.acme.com" or a full http(s) URL. Rejects anything else. */
export const websiteSchema = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || isLikelyWebsite(v), 'Enter a valid website, e.g. acme.com');

export function isLikelyWebsite(v: string): boolean {
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    return (u.protocol === 'http:' || u.protocol === 'https:') && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname);
  } catch {
    return false;
  }
}

export const emailSchema = z.email({ error: 'Enter a valid e-mail address' });

// ---------------------------------------------------------------------------
// Lead form / CSV row
// ---------------------------------------------------------------------------
export const leadInputSchema = z.object({
  contact_name: required('Contact name', 160),
  company: required('Company', 200),
  email: optText(254).refine((v) => v === undefined || emailSchema.safeParse(v).success, 'Enter a valid e-mail address'),
  phone: optText(40),
  job_title: optText(160),
  website: optText(300).refine((v) => v === undefined || isLikelyWebsite(v), 'Enter a valid website, e.g. acme.com'),
  industry: optText(120),
  company_size: z
    .union([z.enum(COMPANY_SIZES), z.literal(''), z.null()])
    .transform((v) => (v ? v : undefined))
    .optional(),
  location: optText(160),
  source: z.enum(LEAD_SOURCES).default('Other'),
  status: z.enum(PIPELINE_STAGES).default('New Lead'),
  budget: optText(200),
  requirements: optText(LIMITS.longText),
  notes: optText(8000),
  deal_value: z
    .union([z.number(), z.string(), z.null()])
    .transform((v, ctx) => {
      if (v === null || v === undefined || v === '') return undefined;
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s$€£₹]/g, ''));
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({ code: 'custom', message: 'Deal value must be a positive number' });
        return z.NEVER;
      }
      return Math.round(n * 100) / 100;
    })
    .optional(),
  last_contacted_at: optText(40),
  next_follow_up_at: optText(40),
});
export type LeadFormValues = z.input<typeof leadInputSchema>;
export type LeadParsed = z.output<typeof leadInputSchema>;

// ---------------------------------------------------------------------------
// Netlify Function request bodies
// ---------------------------------------------------------------------------
export const researchRequestSchema = z.object({
  company_name: required('Company name', 200),
  website: optText(300).refine((v) => v === undefined || isLikelyWebsite(v), 'Enter a valid website, e.g. acme.com'),
  industry: optText(120),
  description: optText(LIMITS.longText),
  target_customer: optText(LIMITS.mediumText),
  product: optText(LIMITS.mediumText),
  lead_id: uuid.optional(),
  use_live_search: z.boolean().optional().default(false),
});
export type ResearchRequest = z.infer<typeof researchRequestSchema>;

export const scoreRequestSchema = z.object({ lead_id: uuid });
export type ScoreRequest = z.infer<typeof scoreRequestSchema>;

export const emailRequestSchema = z
  .object({
    action: z.enum(EMAIL_ACTIONS).default('generate'),
    prospect_name: required('Prospect name', 160),
    company: required('Company', 200),
    industry: optText(120),
    product: required('Product or service', LIMITS.mediumText),
    benefits: optText(LIMITS.mediumText),
    pain_points: optText(LIMITS.mediumText),
    tone: z.enum(EMAIL_TONES).default('Professional'),
    lead_id: uuid.optional(),
    instructions: optText(500),
    existing: z
      .object({ subject: text(300), body: text(6000).min(1, 'Existing e-mail body is required') })
      .optional(),
  })
  .refine((v) => v.action === 'generate' || v.action === 'variants' || v.existing !== undefined, {
    message: 'An existing e-mail is required for rewrite, shorten and personalize',
    path: ['existing'],
  });
export type EmailRequest = z.infer<typeof emailRequestSchema>;

export const followupRequestSchema = z.object({
  lead_id: uuid,
  followup_id: uuid.optional(),
  tone: z.enum(EMAIL_TONES).default('Professional'),
  context: optText(LIMITS.mediumText),
});
export type FollowupRequest = z.infer<typeof followupRequestSchema>;

export const assistantRequestSchema = z.object({
  message: required('Message', LIMITS.assistantMessage),
  conversation_id: uuid.optional(),
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

export const insightsRequestSchema = z.object({
  scope: z.enum(['dashboard', 'analytics']).default('dashboard'),
});
export type InsightsRequest = z.infer<typeof insightsRequestSchema>;

/** Turn a ZodError into a short, user-safe message ("field: problem; …"). */
export function formatZodError(err: z.ZodError): string {
  return err.issues
    .slice(0, 5)
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('; ');
}

// ---------------------------------------------------------------------------
// AI response shapes (validated after every Gemini call)
// ---------------------------------------------------------------------------
const str = (max = 4000) => z.string().trim().min(1).max(max);
const strList = (maxItems: number, maxLen = 600) => z.array(z.string().trim().min(1).max(maxLen)).max(maxItems * 2);

export const researchAiSchema = z.object({
  company_overview: str(3000),
  industry_classification: z.object({
    primary: str(160),
    sub_industry: z.string().trim().max(160),
    confidence: z.enum(['low', 'medium', 'high']),
  }),
  likely_challenges: strList(6),
  customer_needs: strList(6),
  product_use_cases: strList(6),
  value_proposition: str(2000),
  sales_approach: str(2000),
  outreach_angle: str(2000),
  verified_information: z
    .array(
      z.object({
        statement: str(600),
        basis: z.enum(['user_input', 'web']),
        source_url: z.string().trim().max(500).nullable().optional(),
      }),
    )
    .max(20),
  ai_hypotheses: strList(8),
  information_gaps: strList(6),
});
export type ResearchAi = z.infer<typeof researchAiSchema>;

const factor = z.object({ score: z.number(), reason: z.string().trim().max(400) });
export const scoreAiSchema = z.object({
  score: z.number(),
  label: z.enum(SCORE_LABELS).optional(),
  explanation: str(2000),
  factors: z.object({
    industry_relevance: factor,
    company_size: factor,
    requirements: factor,
    budget_indicators: factor,
    decision_maker_relevance: factor,
    product_fit: factor,
    engagement: factor,
  }),
  positive_indicators: strList(6, 400),
  risk_factors: strList(6, 400),
  next_action: str(600),
  data_completeness: z.enum(['low', 'medium', 'high']),
});
export type ScoreAi = z.infer<typeof scoreAiSchema>;

const emailDraft = z.object({
  subject: str(200),
  opening: str(1200),
  problem_statement: str(1500),
  value_proposition: str(1500),
  cta: str(600),
  body: str(6000),
});
export const emailAiSchema = z.object({ emails: z.array(emailDraft).min(1).max(5) });
export type EmailAi = z.infer<typeof emailAiSchema>;

export const followupAiSchema = z.object({
  subject: str(200),
  body: str(5000),
  channel: z.enum(FOLLOWUP_CHANNELS),
  recommended_days_from_now: z.number(),
  timing_reason: str(600),
  talking_points: strList(5, 300),
});
export type FollowupAi = z.infer<typeof followupAiSchema>;

export const assistantAiSchema = z.object({
  answer: str(8000),
  referenced_lead_ids: z.array(z.string()).max(30),
  suggested_actions: strList(5, 300),
});
export type AssistantAi = z.infer<typeof assistantAiSchema>;

export const insightsAiSchema = z.object({
  summary: str(1200),
  insights: z
    .array(
      z.object({
        title: str(160),
        detail: str(800),
        type: z.enum(['opportunity', 'risk', 'action']),
        priority: z.enum(['high', 'medium', 'low']),
      }),
    )
    .max(10),
  recommendations: strList(6, 500),
});
export type InsightsAi = z.infer<typeof insightsAiSchema>;
