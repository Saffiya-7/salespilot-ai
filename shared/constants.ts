// Values shared by the React app and the Netlify Functions.
// They must stay in sync with the CHECK constraints in supabase/migrations.

export const PIPELINE_STAGES = [
  'New Lead',
  'Contacted',
  'Interested',
  'Meeting Scheduled',
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Lost',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Stages that count as an active, open opportunity. */
export const OPEN_STAGES: readonly PipelineStage[] = [
  'New Lead',
  'Contacted',
  'Interested',
  'Meeting Scheduled',
  'Proposal Sent',
  'Negotiation',
];

/** A lead is "qualified" once it has shown interest (Interested or later), excluding Lost. */
export const QUALIFIED_STAGES: readonly PipelineStage[] = [
  'Interested',
  'Meeting Scheduled',
  'Proposal Sent',
  'Negotiation',
  'Won',
];

export const LEAD_SOURCES = [
  'Website',
  'Referral',
  'LinkedIn',
  'Cold Outreach',
  'Event',
  'Partner',
  'Advertising',
  'CSV Import',
  'Other',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const EMAIL_TONES = ['Professional', 'Friendly', 'Persuasive', 'Formal', 'Short and Direct'] as const;
export type EmailTone = (typeof EMAIL_TONES)[number];

export const SCORE_LABELS = ['Hot', 'Warm', 'Cold'] as const;
export type ScoreLabel = (typeof SCORE_LABELS)[number];

/** Score thresholds. The label is always derived from the number so they never disagree. */
export const SCORE_THRESHOLDS = { hot: 75, warm: 45 } as const;

export const FOLLOWUP_CHANNELS = ['email', 'call', 'linkedin', 'meeting', 'other'] as const;
export type FollowupChannel = (typeof FOLLOWUP_CHANNELS)[number];

export const FOLLOWUP_STATUSES = ['pending', 'completed', 'skipped'] as const;
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];

export const ACTIVITY_TYPES = [
  'lead_created',
  'lead_updated',
  'stage_changed',
  'note',
  'call',
  'meeting',
  'email_generated',
  'email_sent',
  'followup_scheduled',
  'followup_completed',
  'lead_scored',
  'research_completed',
  'import',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const EMAIL_ACTIONS = ['generate', 'variants', 'rewrite', 'shorten', 'personalize'] as const;
export type EmailAction = (typeof EMAIL_ACTIONS)[number];

export const SCORE_FACTORS = [
  { key: 'industry_relevance', label: 'Industry relevance' },
  { key: 'company_size', label: 'Company size fit' },
  { key: 'requirements', label: 'Requirements match' },
  { key: 'budget_indicators', label: 'Budget indicators' },
  { key: 'decision_maker_relevance', label: 'Decision-maker relevance' },
  { key: 'product_fit', label: 'Product fit' },
  { key: 'engagement', label: 'Engagement' },
] as const;
export type ScoreFactorKey = (typeof SCORE_FACTORS)[number]['key'];

/** Common industries offered in dropdowns (free text is still allowed). */
export const COMMON_INDUSTRIES = [
  'SaaS / Software',
  'IT Services',
  'E-commerce / Retail',
  'Financial Services',
  'Healthcare',
  'Education',
  'Manufacturing',
  'Real Estate',
  'Marketing / Advertising',
  'Logistics',
  'Hospitality',
  'Professional Services',
  'Media / Entertainment',
  'Telecommunications',
  'Energy',
  'Non-profit',
  'Other',
] as const;

/** Text field limits enforced by both client and server validation. */
export const LIMITS = {
  shortText: 200,
  mediumText: 1000,
  longText: 4000,
  assistantMessage: 2000,
  maxRequestBytes: 32 * 1024,
  csvMaxRows: 5000,
  csvMaxBytes: 5 * 1024 * 1024,
} as const;
