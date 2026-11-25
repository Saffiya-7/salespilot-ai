// Retrieval layer for the AI Sales Assistant and Insights: loads the user's
// real rows (through RLS) and turns them into a compact, factual snapshot.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeDashboardMetrics,
  followupStats,
  followupUrgency,
  funnel,
  monthlyGrowth,
  segmentPerformance,
  staleLeads,
  stageDistribution,
} from '../../shared/metrics';
import type { Followup, Lead, LeadScore, Profile, SalesActivity } from '../../shared/types';
import { HttpError } from './http';
import { isMissingTableError } from './rateLimit';

export interface AccountData {
  profile: Profile | null;
  leads: Lead[];
  followups: Followup[];
  activities: SalesActivity[];
  emailsGenerated: number;
}

const LEAD_COLUMNS =
  'id,contact_name,email,job_title,company,website,industry,company_size,location,source,status,budget,requirements,notes,deal_value,score,score_label,scored_at,research,last_contacted_at,next_follow_up_at,status_changed_at,created_at,updated_at';

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error) {
    if (isMissingTableError(res.error)) throw new HttpError(503, 'SERVER_NOT_CONFIGURED', 'The database is missing tables. Run the SQL migration in supabase/migrations (see README).');
    console.error(`[account-data] ${what}`, res.error.message);
    throw new HttpError(500, 'INTERNAL', 'Could not load your data. Please try again.');
  }
  return (res.data ?? []) as T;
}

export async function loadAccountData(supabase: SupabaseClient, userId: string): Promise<AccountData> {
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
  const [profile, leads, followups, activities, emails] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('leads').select(LEAD_COLUMNS).order('created_at', { ascending: false }).limit(3000),
    supabase.from('followups').select('*').order('due_at', { ascending: true }).limit(3000),
    supabase.from('sales_activities').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(1500),
    supabase.from('generated_emails').select('id', { count: 'exact', head: true }),
  ]);
  return {
    profile: (profile.data as Profile | null) ?? null,
    leads: check(leads, 'leads') as unknown as Lead[],
    followups: check(followups, 'followups') as Followup[],
    activities: check(activities, 'activities') as SalesActivity[],
    emailsGenerated: emails.count ?? 0,
  };
}

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

function leadRow(l: Lead) {
  return {
    id: l.id,
    name: l.contact_name,
    title: l.job_title,
    company: l.company,
    industry: l.industry,
    size: l.company_size,
    stage: l.status,
    ai_score: l.score,
    priority: l.score_label,
    source: l.source,
    deal_value: l.deal_value,
    last_contacted: day(l.last_contacted_at),
    next_follow_up: day(l.next_follow_up_at),
    days_in_stage: Math.floor((Date.now() - new Date(l.status_changed_at).getTime()) / 86_400_000),
  };
}

/** Rank leads for "what should I work on" style questions. */
export function priorityRank(leads: Lead[], followups: Followup[], now = new Date()): Lead[] {
  const dueByLead = new Map<string, 'overdue' | 'today' | 'upcoming'>();
  for (const f of followups) {
    if (f.status !== 'pending') continue;
    const u = followupUrgency(f.due_at, now);
    const prev = dueByLead.get(f.lead_id);
    if (!prev || (u === 'overdue') || (u === 'today' && prev === 'upcoming')) dueByLead.set(f.lead_id, u);
  }
  const score = (l: Lead) => {
    let s = l.score ?? 35;
    const due = dueByLead.get(l.id);
    if (due === 'overdue') s += 25;
    else if (due === 'today') s += 20;
    if (['Negotiation', 'Proposal Sent', 'Meeting Scheduled'].includes(l.status)) s += 15;
    else if (l.status === 'Interested') s += 10;
    return s;
  };
  return leads.filter((l) => l.status !== 'Won' && l.status !== 'Lost').sort((a, b) => score(b) - score(a));
}

const GENERIC_WORDS = new Set(['the', 'global', 'international', 'group', 'digital', 'tech', 'solutions', 'services', 'company', 'india', 'first', 'best', 'smart', 'great', 'united']);

/** Leads explicitly mentioned (by contact or company name) in the user's message. */
export function matchMentionedLeads(message: string, leads: Lead[], max = 5): Lead[] {
  const m = message.toLowerCase();
  const hits = leads.filter((l) => {
    const firstWord = (s: string) => s.trim().split(/\s+/)[0] ?? '';
    const companyHead = firstWord(l.company);
    const names = [l.company, l.contact_name, firstWord(l.contact_name), companyHead.length >= 4 && !GENERIC_WORDS.has(companyHead.toLowerCase()) ? companyHead : '']
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length >= 3);
    return names.some((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(m));
  });
  return hits.slice(0, max);
}

export function buildSnapshot(data: AccountData, opts: { now?: Date; focus?: Lead[]; latestScores?: LeadScore[] } = {}) {
  const now = opts.now ?? new Date();
  const { leads, followups, activities } = data;
  const metrics = computeDashboardMetrics(leads, followups, data.emailsGenerated, now);
  const fstats = followupStats(followups, now);
  const leadName = new Map(leads.map((l) => [l.id, `${l.contact_name} (${l.company})`]));
  const pendingDue = followups
    .filter((f) => f.status === 'pending' && followupUrgency(f.due_at, now) !== 'upcoming')
    .slice(0, 25)
    .map((f) => ({ lead_id: f.lead_id, lead: leadName.get(f.lead_id) ?? 'Unknown lead', due: day(f.due_at), urgency: followupUrgency(f.due_at, now), channel: f.channel, note: f.note }));
  const upcoming = followups
    .filter((f) => f.status === 'pending' && followupUrgency(f.due_at, now) === 'upcoming')
    .slice(0, 10)
    .map((f) => ({ lead_id: f.lead_id, lead: leadName.get(f.lead_id) ?? 'Unknown lead', due: day(f.due_at), channel: f.channel }));
  const ranked = priorityRank(leads, followups, now);
  const LIST_LIMIT = 120;

  return {
    generated_at: now.toISOString(),
    seller: data.profile
      ? {
          company: data.profile.company_name,
          product: data.profile.product_name,
          product_description: data.profile.product_description,
          target_customer: data.profile.target_customer,
          value_proposition: data.profile.value_proposition,
        }
      : null,
    totals: {
      ...metrics,
      definitions: {
        qualifiedLeads: 'stage is Interested, Meeting Scheduled, Proposal Sent, Negotiation or Won',
        highPriorityLeads: 'open leads with AI priority Hot (score ≥ 75)',
        conversionRate: 'Won ÷ all leads, %',
        winRate: 'Won ÷ (Won + Lost), %',
      },
    },
    pipeline_by_stage: stageDistribution(leads),
    funnel: funnel(leads),
    by_industry: segmentPerformance(leads, (l) => l.industry).slice(0, 12),
    by_source: segmentPerformance(leads, (l) => l.source),
    monthly: monthlyGrowth(leads, 6, now).map(({ label, newLeads, won }) => ({ month: label, new_leads: newLeads, won })),
    followups: { ...fstats, due_or_overdue: pendingDue, upcoming },
    stale_open_leads: staleLeads(leads, 14, now).slice(0, 15).map(leadRow),
    never_contacted_open_leads: leads.filter((l) => !l.last_contacted_at && l.status === 'New Lead').length,
    activity_last_30_days: activities.filter((a) => now.getTime() - new Date(a.created_at).getTime() <= 30 * 86_400_000).length,
    recent_activity: activities.slice(0, 15).map((a) => ({ date: day(a.created_at), type: a.type, description: a.description })),
    priority_candidates: ranked.slice(0, 15).map(leadRow),
    leads: ranked.slice(0, LIST_LIMIT).map(leadRow),
    leads_note: leads.length > LIST_LIMIT ? `Only the ${LIST_LIMIT} highest-priority open leads are listed; totals above cover all ${leads.length} leads.` : undefined,
    focus_leads: (opts.focus ?? []).map((l) => {
      const s = opts.latestScores?.find((x) => x.lead_id === l.id);
      return {
        ...leadRow(l),
        email_on_file: Boolean(l.email),
        website: l.website,
        location: l.location,
        budget: l.budget,
        requirements: l.requirements,
        notes: l.notes,
        research_overview: l.research?.company_overview ?? null,
        research_outreach_angle: l.research?.outreach_angle ?? null,
        latest_score_explanation: s?.explanation ?? null,
        latest_score_next_action: s?.next_action ?? null,
        recent_activity: activities.filter((a) => a.lead_id === l.id).slice(0, 8).map((a) => ({ date: day(a.created_at), type: a.type, description: a.description })),
      };
    }),
  };
}
