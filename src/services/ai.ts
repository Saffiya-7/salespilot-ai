// Typed wrappers around the Netlify Functions. All AI work happens server-side.
import type { z } from 'zod';
import type {
  assistantRequestSchema,
  emailRequestSchema,
  followupRequestSchema,
  researchRequestSchema,
} from '../../shared/schemas';
import type {
  ChatMessage,
  EmailDraft,
  FollowupDraft,
  GeneratedEmail,
  InsightsResult,
  LeadScore,
  ResearchResult,
  ScoreResult,
} from '../../shared/types';
import { callFunction } from '../lib/api';

export interface AiStatus {
  gemini_configured: boolean;
  model: string;
  live_search: { provider: 'none' | 'gemini' | 'tavily'; configured: boolean };
  supabase_configured: boolean;
  limits: { perMinute: number; perDay: number };
  email_sending: 'not_configured';
}

export const getAiStatus = () => callFunction<AiStatus>('ai-status', undefined, { method: 'GET' });

export const researchCompany = (input: z.input<typeof researchRequestSchema>) =>
  callFunction<{ research: ResearchResult; saved_to_lead: boolean }>('research-company', input);

export const scoreLead = (leadId: string) =>
  callFunction<{ result: ScoreResult; score: LeadScore; model: string }>('score-lead', { lead_id: leadId });

export const generateEmail = (input: z.input<typeof emailRequestSchema>) =>
  callFunction<{ emails: (EmailDraft & { id: string })[]; records: GeneratedEmail[]; model: string }>('generate-email', input);

export const generateFollowup = (input: z.input<typeof followupRequestSchema>) =>
  callFunction<{ draft: FollowupDraft; email_id: string | null; model: string }>('generate-followup', input);

export const askAssistant = (input: z.input<typeof assistantRequestSchema>) =>
  callFunction<{ conversation_id: string; message: ChatMessage }>('sales-assistant', input);

export const generateInsights = (scope: 'dashboard' | 'analytics') =>
  callFunction<InsightsResult>('generate-insights', { scope });
