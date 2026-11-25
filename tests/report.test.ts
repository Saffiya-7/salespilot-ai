import { describe, expect, it } from 'vitest';
import { analyticsCsv, analyticsPdf, buildAnalytics } from '../src/utils/report';
import { makeActivity, makeFollowup, makeLead } from './fixtures';

const NOW = new Date(2026, 10, 25, 12);
const data = buildAnalytics(
  [
    makeLead({ status: 'Won', industry: 'SaaS', source: 'Referral', deal_value: 5000, created_at: new Date(2026, 9, 3).toISOString(), status_changed_at: new Date(2026, 10, 2).toISOString() }),
    makeLead({ status: 'Lost', industry: 'SaaS', source: 'LinkedIn', created_at: new Date(2026, 10, 3).toISOString() }),
    makeLead({ status: 'Interested', industry: '=cmd()', source: 'LinkedIn', created_at: new Date(2026, 10, 10).toISOString() }),
  ],
  [makeFollowup({ status: 'completed' })],
  [makeActivity({ created_at: new Date(2026, 10, 24).toISOString(), type: 'call' })],
  4,
  NOW,
);

describe('analytics reports', () => {
  it('builds report data from real rows', () => {
    expect(data.metrics.totalLeads).toBe(3);
    expect(data.metrics.winRate).toBe(50);
    expect(data.activityByType).toEqual([{ name: 'call', count: 1 }]);
    expect(data.monthly).toHaveLength(12);
  });

  it('exports a CSV with every section and formula-safe cells', () => {
    const csv = analyticsCsv(data);
    expect(csv).toMatch(/Total leads,3/);
    expect(csv).toMatch(/Win rate % \(won \/ closed\),50/);
    expect(csv).toMatch(/^Stage,Leads,Deal value/m);
    expect(csv).toMatch(/^Industry,Leads,Won/m);
    expect(csv).toContain(`'=cmd()`);
    expect(csv).not.toMatch(/^=cmd/m);
  });

  it('renders a PDF document', async () => {
    const blob = await analyticsPdf(data, { account: 'Test Co', generatedAt: NOW });
    const head = Buffer.from(await blob.slice(0, 5).arrayBuffer()).toString();
    expect(head).toBe('%PDF-');
    expect(blob.size).toBeGreaterThan(3000);
  });
});
