import { describe, expect, it } from 'vitest';
import {
  computeDashboardMetrics,
  countBy,
  followupStats,
  followupUrgency,
  funnel,
  monthlyGrowth,
  percent,
  segmentPerformance,
  staleLeads,
  stageDistribution,
  weeklyActivity,
} from '../shared/metrics';
import { filterLeads, sortLeads, EMPTY_FILTERS } from '../src/utils/leadFilters';
import { makeActivity, makeFollowup, makeLead } from './fixtures';

// Wednesday 25 Nov 2026, 15:00 local time
const NOW = new Date(2026, 10, 25, 15, 0, 0);
const iso = (y: number, m: number, d: number, h = 10) => new Date(y, m, d, h).toISOString();

const leads = [
  makeLead({ status: 'New Lead', source: 'LinkedIn', industry: 'SaaS', created_at: iso(2026, 10, 2), status_changed_at: iso(2026, 10, 2) }),
  makeLead({ status: 'Interested', source: 'LinkedIn', industry: 'SaaS', score: 82, score_label: 'Hot', deal_value: 1000, created_at: iso(2026, 10, 5) }),
  makeLead({ status: 'Negotiation', source: 'Referral', industry: 'Retail', score: 60, score_label: 'Warm', deal_value: 5000, created_at: iso(2026, 9, 12) }),
  makeLead({ status: 'Won', source: 'Referral', industry: 'SaaS', score: 90, score_label: 'Hot', deal_value: 2000, created_at: iso(2026, 8, 1), status_changed_at: iso(2026, 10, 20) }),
  makeLead({ status: 'Lost', source: 'Event', industry: null, score: 20, score_label: 'Cold', created_at: iso(2026, 3, 1) }),
];
const followups = [
  makeFollowup({ due_at: iso(2026, 10, 20), status: 'pending' }), // overdue
  makeFollowup({ due_at: iso(2026, 10, 25, 9), status: 'pending' }), // today (earlier hour)
  makeFollowup({ due_at: iso(2026, 10, 25, 18), status: 'pending' }), // today (later hour)
  makeFollowup({ due_at: iso(2026, 10, 28), status: 'pending' }), // upcoming
  makeFollowup({ due_at: iso(2026, 10, 10), status: 'completed', completed_at: iso(2026, 10, 10) }),
  makeFollowup({ due_at: iso(2026, 10, 11), status: 'skipped' }),
];

describe('percent', () => {
  it('returns null instead of dividing by zero', () => {
    expect(percent(1, 0)).toBeNull();
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(2, 2)).toBe(100);
  });
});

describe('computeDashboardMetrics', () => {
  it('computes every dashboard card from rows', () => {
    const m = computeDashboardMetrics(leads, followups, 7, NOW);
    expect(m.totalLeads).toBe(5);
    expect(m.qualifiedLeads).toBe(3); // Interested, Negotiation, Won
    expect(m.highPriorityLeads).toBe(1); // Hot and still open (the Won one is excluded)
    expect(m.emailsGenerated).toBe(7);
    expect(m.followupsDue).toBe(3); // overdue + both of today's
    expect(m.overdueFollowups).toBe(1);
    expect(m.conversionRate).toBe(20); // 1 won / 5
    expect(m.winRate).toBe(50); // 1 won / (1 won + 1 lost)
    expect(m.openPipelineValue).toBe(6000);
    expect(m.wonValue).toBe(2000);
    expect(m.averageScore).toBe(63); // (82+60+90+20)/4
  });

  it('shows empty (null) rates for an empty account instead of fake numbers', () => {
    const m = computeDashboardMetrics([], [], 0, NOW);
    expect(m.totalLeads).toBe(0);
    expect(m.conversionRate).toBeNull();
    expect(m.winRate).toBeNull();
    expect(m.averageScore).toBeNull();
  });
});

describe('monthlyGrowth', () => {
  it('buckets new and won leads per month with a running total', () => {
    const g = monthlyGrowth(leads, 3, NOW);
    expect(g.map((x) => x.month)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(g.map((x) => x.newLeads)).toEqual([1, 1, 2]);
    expect(g[2].won).toBe(1);
    // the April lead is before the window but counts toward the cumulative total
    expect(g.map((x) => x.cumulative)).toEqual([2, 3, 5]);
  });
});

describe('distributions', () => {
  it('counts per stage including empty stages', () => {
    const s = stageDistribution(leads);
    expect(s).toHaveLength(8);
    expect(s.find((x) => x.stage === 'Negotiation')).toEqual({ stage: 'Negotiation', count: 1, value: 5000 });
    expect(s.find((x) => x.stage === 'Meeting Scheduled')?.count).toBe(0);
  });

  it('countBy sorts, labels blanks and folds the tail into Other', () => {
    const c = countBy(['a', 'a', 'b', 'c', 'd', '', null], (x) => x, 3);
    expect(c[0]).toEqual({ name: 'a', count: 2 });
    expect(c.find((x) => x.name === 'Not specified')?.count).toBe(2); // '' and null
    expect(c.find((x) => x.name === 'Other')?.count).toBe(3); // b, c, d
    expect(c).toHaveLength(3);
  });

  it('segmentPerformance computes win and conversion rates per industry', () => {
    const seg = segmentPerformance(leads, (l) => l.industry);
    const saas = seg.find((s) => s.name === 'SaaS')!;
    expect(saas).toMatchObject({ total: 3, won: 1, lost: 0, winRate: 100, conversionRate: 33.3, averageScore: 86 });
    expect(seg.find((s) => s.name === 'Not specified')?.lost).toBe(1);
  });

  it('funnel counts leads that reached each stage', () => {
    const f = funnel(leads);
    expect(f[0]).toEqual({ stage: 'New Lead', reached: 4, rate: 80 });
    expect(f.find((x) => x.stage === 'Interested')?.reached).toBe(3);
    expect(f.find((x) => x.stage === 'Won')?.reached).toBe(1);
  });
});

describe('follow-ups', () => {
  it('classifies urgency relative to today', () => {
    expect(followupUrgency(iso(2026, 10, 24), NOW)).toBe('overdue');
    expect(followupUrgency(iso(2026, 10, 25, 23), NOW)).toBe('today');
    expect(followupUrgency(iso(2026, 10, 26, 1), NOW)).toBe('upcoming');
  });

  it('computes completion rate over follow-ups that were due', () => {
    const s = followupStats(followups, NOW);
    expect(s).toMatchObject({ total: 6, completed: 1, skipped: 1, pending: 4, overdue: 1, dueToday: 2, upcoming: 1 });
    expect(s.completionRate).toBe(33.3); // 1 / (1 completed + 1 skipped + 1 overdue)
    expect(followupStats([], NOW).completionRate).toBeNull();
  });
});

describe('activity and staleness', () => {
  it('buckets activity per week', () => {
    const w = weeklyActivity(
      [makeActivity({ created_at: iso(2026, 10, 24) }), makeActivity({ created_at: iso(2026, 10, 23), type: 'call' }), makeActivity({ created_at: iso(2026, 10, 17) }), makeActivity({ created_at: iso(2025, 1, 1) })],
      2,
      NOW,
    );
    expect(w).toHaveLength(2);
    expect(w[1].total).toBe(2); // Mon 23 + Tue 24
    expect(w[1].byType.call).toBe(1);
    expect(w[0].total).toBe(1);
  });

  it('finds open leads stuck in a stage', () => {
    const stuck = staleLeads(leads, 14, NOW);
    expect(stuck.map((l) => l.status).sort()).toEqual(['Interested', 'Negotiation', 'New Lead']);
  });
});

describe('lead filters', () => {
  it('filters by search, stage, industry and score', () => {
    expect(filterLeads(leads, { ...EMPTY_FILTERS, score: 'Hot' })).toHaveLength(2);
    expect(filterLeads(leads, { ...EMPTY_FILTERS, score: 'unscored' })).toHaveLength(1);
    expect(filterLeads(leads, { ...EMPTY_FILTERS, industry: 'saas', stage: 'Won' })).toHaveLength(1);
    expect(filterLeads([makeLead({ company: 'Northwind Labs' })], { ...EMPTY_FILTERS, q: 'northwind' })).toHaveLength(1);
  });
  it('sorts by score with unscored last', () => {
    expect(sortLeads(leads, 'score_desc').map((l) => l.score)).toEqual([90, 82, 60, 20, null]);
  });
});
