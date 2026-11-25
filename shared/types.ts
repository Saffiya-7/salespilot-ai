// Row types that mirror the Supabase tables (see supabase/migrations).
import type {
  ActivityType,
  CompanySize,
  EmailAction,
  EmailTone,
  FollowupChannel,
  FollowupStatus,
  LeadSource,
  PipelineStage,
  ScoreFactorKey,
  ScoreLabel,
} from './constants';

export interface Profile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  job_title: string | null;
  product_name: string | null;
  product_description: string | null;
  target_customer: string | null;
  value_proposition: string | null;
  default_tone: EmailTone;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  user_id: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  company: string;
  website: string | null;
  industry: string | null;
  company_size: CompanySize | null;
  location: string | null;
  source: LeadSource;
  status: PipelineStage;
  budget: string | null;
  requirements: string | null;
  notes: string | null;
  deal_value: number | null;
  score: number | null;
  score_label: ScoreLabel | null;
  scored_at: string | null;
  research: ResearchResult | null;
  researched_at: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
}

/** Fields a user may write when creating or editing a lead. */
export type LeadInput = Pick<
  Lead,
  | 'contact_name'
  | 'email'
  | 'phone'
  | 'job_title'
  | 'company'
  | 'website'
  | 'industry'
  | 'company_size'
  | 'location'
  | 'source'
  | 'status'
  | 'budget'
  | 'requirements'
  | 'notes'
  | 'deal_value'
  | 'last_contacted_at'
  | 'next_follow_up_at'
>;

export type ScoreFactors = Record<ScoreFactorKey, { score: number; reason: string }>;

export interface LeadScore {
  id: string;
  user_id: string;
  lead_id: string;
  score: number;
  label: ScoreLabel;
  explanation: string;
  factors: ScoreFactors;
  positive_indicators: string[];
  risk_factors: string[];
  next_action: string;
  data_completeness: 'low' | 'medium' | 'high' | null;
  model: string | null;
  created_at: string;
}

export interface GeneratedEmail {
  id: string;
  user_id: string;
  lead_id: string | null;
  kind: 'cold' | 'followup';
  action: EmailAction | 'followup';
  tone: string | null;
  prospect_name: string | null;
  company: string | null;
  subject: string;
  opening: string | null;
  problem_statement: string | null;
  value_proposition: string | null;
  cta: string | null;
  body: string;
  is_saved: boolean;
  input: Record<string, unknown>;
  model: string | null;
  created_at: string;
}

export interface Followup {
  id: string;
  user_id: string;
  lead_id: string;
  due_at: string;
  channel: FollowupChannel;
  status: FollowupStatus;
  note: string | null;
  message: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesActivity {
  id: string;
  user_id: string;
  lead_id: string | null;
  type: ActivityType;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  referenced_lead_ids?: string[];
  suggested_actions?: string[];
  data_used?: string[];
}

export interface AiConversation {
  id: string;
  user_id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// AI result shapes (returned by the Netlify Functions)
// ---------------------------------------------------------------------------

export interface ResearchSource {
  title: string;
  url: string;
}

export interface VerifiedStatement {
  statement: string;
  /** 'user_input' = you typed it; 'web' = found by the live search provider. */
  basis: 'user_input' | 'web';
  source_url: string | null;
}

export interface ResearchResult {
  mode: 'input_only' | 'live_search';
  company_overview: string;
  industry_classification: { primary: string; sub_industry: string; confidence: 'low' | 'medium' | 'high' };
  likely_challenges: string[];
  customer_needs: string[];
  product_use_cases: string[];
  value_proposition: string;
  sales_approach: string;
  outreach_angle: string;
  verified_information: VerifiedStatement[];
  ai_hypotheses: string[];
  information_gaps: string[];
  sources: ResearchSource[];
  generated_at: string;
  model: string;
}

export interface ScoreResult {
  score: number;
  label: ScoreLabel;
  explanation: string;
  factors: ScoreFactors;
  positive_indicators: string[];
  risk_factors: string[];
  next_action: string;
  data_completeness: 'low' | 'medium' | 'high';
}

export interface EmailDraft {
  subject: string;
  opening: string;
  problem_statement: string;
  value_proposition: string;
  cta: string;
  body: string;
}

export interface FollowupDraft {
  subject: string;
  body: string;
  channel: FollowupChannel;
  recommended_days_from_now: number;
  timing_reason: string;
  talking_points: string[];
}

export interface Insight {
  title: string;
  detail: string;
  type: 'opportunity' | 'risk' | 'action';
  priority: 'high' | 'medium' | 'low';
}

export interface InsightsResult {
  summary: string;
  insights: Insight[];
  recommendations: string[];
  generated_at: string;
  based_on: { total_leads: number; activities: number; followups: number };
}
