// Pure metric calculations. Every number shown on the Dashboard and Analytics
// pages, and every number given to the AI, comes from these functions applied
// to the user's real rows — nothing is hard-coded.
import { OPEN_STAGES, PIPELINE_STAGES, QUALIFIED_STAGES, type PipelineStage } from './constants';
import type { Followup, Lead, SalesActivity } from './types';

type LeadLike = Pick<
  Lead,
  'status' | 'score' | 'score_label' | 'source' | 'industry' | 'created_at' | 'deal_value' | 'status_changed_at'
>;
type FollowupLike = Pick<Followup, 'status' | 'due_at' | 'completed_at'>;
type ActivityLike = Pick<SalesActivity, 'type' | 'created_at'>;

const DAY = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Ratio as a percentage with one decimal, or null when the denominator is 0 (shown as "—"). */
export function percent(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export interface DashboardMetrics {
  totalLeads: number;
  qualifiedLeads: number;
  highPriorityLeads: number;
  emailsGenerated: number;
  followupsDue: number;
  overdueFollowups: number;
  wonLeads: number;
  lostLeads: number;
  /** Won ÷ all leads, in %. null when there are no leads. */
  conversionRate: number | null;
  /** Won ÷ (Won + Lost), in %. null when nothing is closed yet. */
  winRate: number | null;
  openPipelineValue: number;
  wonValue: number;
  scoredLeads: number;
  averageScore: number | null;
}

export function computeDashboardMetrics(
  leads: LeadLike[],
  followups: FollowupLike[],
  emailsGenerated: number,
  now: Date = new Date(),
): DashboardMetrics {
  const won = leads.filter((l) => l.status === 'Won').length;
  const lost = leads.filter((l) => l.status === 'Lost').length;
  const scored = leads.filter((l) => typeof l.score === 'number');
  const endToday = endOfDay(now).getTime();
  const pending = followups.filter((f) => f.status === 'pending');
  return {
    totalLeads: leads.length,
    qualifiedLeads: leads.filter((l) => QUALIFIED_STAGES.includes(l.status)).length,
    highPriorityLeads: leads.filter((l) => l.score_label === 'Hot' && l.status !== 'Won' && l.status !== 'Lost').length,
    emailsGenerated,
    followupsDue: pending.filter((f) => new Date(f.due_at).getTime() <= endToday).length,
    overdueFollowups: pending.filter((f) => new Date(f.due_at).getTime() < startOfDay(now).getTime()).length,
    wonLeads: won,
    lostLeads: lost,
    conversionRate: percent(won, leads.length),
    winRate: percent(won, won + lost),
    openPipelineValue: sum(leads.filter((l) => OPEN_STAGES.includes(l.status)).map((l) => Number(l.deal_value ?? 0))),
    wonValue: sum(leads.filter((l) => l.status === 'Won').map((l) => Number(l.deal_value ?? 0))),
    scoredLeads: scored.length,
    averageScore: scored.length ? Math.round(sum(scored.map((l) => l.score as number)) / scored.length) : null,
  };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface MonthlyPoint {
  month: string; // YYYY-MM
  label: string; // "Nov 26"
  newLeads: number;
  won: number;
  cumulative: number;
}

/** Leads created (and won) per calendar month for the last `months` months, oldest first. */
export function monthlyGrowth(leads: LeadLike[], months = 6, now: Date = new Date()): MonthlyPoint[] {
  const buckets: MonthlyPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      month: monthKey(d),
      label: `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      newLeads: 0,
      won: 0,
      cumulative: 0,
    });
  }
  const index = new Map(buckets.map((b, i) => [b.month, i]));
  const firstMonthStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1).getTime();
  let before = 0;
  for (const l of leads) {
    const created = new Date(l.created_at);
    const i = index.get(monthKey(created));
    if (i !== undefined) buckets[i].newLeads++;
    else if (created.getTime() < firstMonthStart) before++;
    if (l.status === 'Won' && l.status_changed_at) {
      const wi = index.get(monthKey(new Date(l.status_changed_at)));
      if (wi !== undefined) buckets[wi].won++;
    }
  }
  let running = before;
  for (const b of buckets) {
    running += b.newLeads;
    b.cumulative = running;
  }
  return buckets;
}

export interface StagePoint {
  stage: PipelineStage;
  count: number;
  value: number;
}

export function stageDistribution(leads: LeadLike[]): StagePoint[] {
  return PIPELINE_STAGES.map((stage) => {
    const inStage = leads.filter((l) => l.status === stage);
    return { stage, count: inStage.length, value: sum(inStage.map((l) => Number(l.deal_value ?? 0))) };
  });
}

export interface NamedCount {
  name: string;
  count: number;
}

/** Counts by a key, sorted descending; extra categories beyond `top` are folded into "Other". */
export function countBy<T>(items: T[], key: (item: T) => string | null | undefined, top = 8): NamedCount[] {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = (key(it) ?? '').trim() || 'Not specified';
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  const sorted = [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  if (sorted.length <= top) return sorted;
  const head = sorted.slice(0, top - 1);
  const rest = sorted.slice(top - 1).reduce((a, b) => a + b.count, 0);
  const existingOther = head.find((h) => h.name === 'Other');
  if (existingOther) existingOther.count += rest;
  else head.push({ name: 'Other', count: rest });
  return head;
}

export const sourceDistribution = (leads: LeadLike[]) => countBy(leads, (l) => l.source);
export const industryDistribution = (leads: LeadLike[], top = 8) => countBy(leads, (l) => l.industry, top);

export interface SegmentPerformance {
  name: string;
  total: number;
  won: number;
  lost: number;
  open: number;
  winRate: number | null;
  conversionRate: number | null;
  averageScore: number | null;
}

/** Win/conversion performance per segment (industry, source …), biggest segments first. */
export function segmentPerformance(leads: LeadLike[], key: (l: LeadLike) => string | null | undefined): SegmentPerformance[] {
  const groups = new Map<string, LeadLike[]>();
  for (const l of leads) {
    const k = (key(l) ?? '').trim() || 'Not specified';
    const g = groups.get(k) ?? [];
    g.push(l);
    groups.set(k, g);
  }
  return [...groups.entries()]
    .map(([name, g]) => {
      const won = g.filter((l) => l.status === 'Won').length;
      const lost = g.filter((l) => l.status === 'Lost').length;
      const scored = g.filter((l) => typeof l.score === 'number');
      return {
        name,
        total: g.length,
        won,
        lost,
        open: g.length - won - lost,
        winRate: percent(won, won + lost),
        conversionRate: percent(won, g.length),
        averageScore: scored.length ? Math.round(sum(scored.map((l) => l.score as number)) / scored.length) : null,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

export interface ScoreBuckets {
  hot: number;
  warm: number;
  cold: number;
  unscored: number;
}

export function scoreBuckets(leads: LeadLike[]): ScoreBuckets {
  const b: ScoreBuckets = { hot: 0, warm: 0, cold: 0, unscored: 0 };
  for (const l of leads) {
    if (l.score_label === 'Hot') b.hot++;
    else if (l.score_label === 'Warm') b.warm++;
    else if (l.score_label === 'Cold') b.cold++;
    else b.unscored++;
  }
  return b;
}

export interface FollowupStats {
  total: number;
  completed: number;
  skipped: number;
  pending: number;
  overdue: number;
  dueToday: number;
  upcoming: number;
  /** Completed ÷ follow-ups that were already due (completed, skipped or overdue), in %. */
  completionRate: number | null;
}

export function followupStats(followups: FollowupLike[], now: Date = new Date()): FollowupStats {
  const sod = startOfDay(now).getTime();
  const eod = endOfDay(now).getTime();
  let completed = 0;
  let skipped = 0;
  let pending = 0;
  let overdue = 0;
  let dueToday = 0;
  let upcoming = 0;
  for (const f of followups) {
    if (f.status === 'completed') completed++;
    else if (f.status === 'skipped') skipped++;
    else {
      pending++;
      const due = new Date(f.due_at).getTime();
      if (due < sod) overdue++;
      else if (due <= eod) dueToday++;
      else upcoming++;
    }
  }
  return {
    total: followups.length,
    completed,
    skipped,
    pending,
    overdue,
    dueToday,
    upcoming,
    completionRate: percent(completed, completed + skipped + overdue),
  };
}

/** Classify one pending follow-up relative to now. */
export function followupUrgency(dueAt: string, now: Date = new Date()): 'overdue' | 'today' | 'upcoming' {
  const due = new Date(dueAt).getTime();
  if (due < startOfDay(now).getTime()) return 'overdue';
  if (due <= endOfDay(now).getTime()) return 'today';
  return 'upcoming';
}

export interface WeeklyActivity {
  week: string; // label e.g. "Nov 17"
  start: string; // ISO date
  total: number;
  byType: Record<string, number>;
}

/** Activity counts per week (Monday start) for the last `weeks` weeks, oldest first. */
export function weeklyActivity(activities: ActivityLike[], weeks = 8, now: Date = new Date()): WeeklyActivity[] {
  const monday = startOfDay(now);
  const dow = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dow);
  const out: WeeklyActivity[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const s = new Date(monday.getTime());
    s.setDate(s.getDate() - i * 7);
    out.push({
      week: `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}`,
      start: s.toISOString(),
      total: 0,
      byType: {},
    });
  }
  const firstStart = new Date(out[0].start).getTime();
  for (const a of activities) {
    const t = new Date(a.created_at).getTime();
    if (t < firstStart || t > now.getTime()) continue;
    const idx = Math.min(out.length - 1, Math.floor((t - firstStart) / (7 * DAY)));
    out[idx].total++;
    out[idx].byType[a.type] = (out[idx].byType[a.type] ?? 0) + 1;
  }
  return out;
}

/** Leads sitting in the same open stage for more than `days` days. */
export function staleLeads<T extends LeadLike>(leads: T[], days = 14, now: Date = new Date()): T[] {
  const cutoff = now.getTime() - days * DAY;
  return leads.filter((l) => OPEN_STAGES.includes(l.status) && new Date(l.status_changed_at).getTime() < cutoff);
}

/** Conversion funnel: how many leads reached at least each stage (Lost excluded from the steps). */
export function funnel(leads: LeadLike[]): { stage: PipelineStage; reached: number; rate: number | null }[] {
  const order: PipelineStage[] = PIPELINE_STAGES.filter((s) => s !== 'Lost');
  const rank = (s: PipelineStage) => order.indexOf(s);
  const total = leads.length;
  return order.map((stage) => {
    const reached = leads.filter((l) => l.status !== 'Lost' && rank(l.status) >= rank(stage)).length;
    return { stage, reached, rate: percent(reached, total) };
  });
}
