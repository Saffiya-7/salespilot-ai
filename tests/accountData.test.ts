import { describe, expect, it } from 'vitest';
import { buildSnapshot, matchMentionedLeads, priorityRank } from '../netlify/lib/accountData';
import { makeActivity, makeFollowup, makeLead } from './fixtures';

const NOW = new Date(2026, 10, 25, 12);
const a = makeLead({ contact_name: 'Priya Sharma', company: 'Northwind Labs', status: 'Interested', score: 70, score_label: 'Warm' });
const b = makeLead({ contact_name: 'Arjun Rao', company: 'Kite', status: 'New Lead', score: 85, score_label: 'Hot' });
const c = makeLead({ contact_name: 'Lee Chan', company: 'Orbit', status: 'Won', score: 95, score_label: 'Hot' });
const d = makeLead({ contact_name: 'Sam Roy', company: 'Delta Co', status: 'Proposal Sent', score: null });
const leads = [a, b, c, d];

describe('matchMentionedLeads (retrieval for the assistant)', () => {
  it('finds leads mentioned by company or contact name', () => {
    expect(matchMentionedLeads('Why is Northwind important?', leads)).toEqual([a]);
    expect(matchMentionedLeads('write an email for priya', leads)).toEqual([a]);
    expect(matchMentionedLeads('what about kite and orbit?', leads).map((l) => l.company)).toEqual(['Kite', 'Orbit']);
    expect(matchMentionedLeads('which leads to prioritise', leads)).toEqual([]);
  });
  it('does not match partial words', () => {
    expect(matchMentionedLeads('kitesurfing tips', leads)).toEqual([]);
  });
});

describe('priorityRank', () => {
  it('excludes closed deals and boosts due follow-ups and late stages', () => {
    const followups = [makeFollowup({ lead_id: a.id, due_at: new Date(2026, 10, 20).toISOString() })];
    const ranked = priorityRank(leads, followups, NOW);
    expect(ranked.map((l) => l.company)).not.toContain('Orbit');
    expect(ranked[0].company).toBe('Northwind Labs'); // 70 + overdue 25 + Interested 10
  });
});

describe('buildSnapshot', () => {
  it('contains only real, computed numbers', () => {
    const s = buildSnapshot(
      {
        profile: null,
        leads,
        followups: [makeFollowup({ lead_id: b.id, due_at: new Date(2026, 10, 25, 9).toISOString() })],
        activities: [makeActivity({ lead_id: a.id, created_at: new Date(2026, 10, 24).toISOString(), description: 'Call went well', type: 'call' })],
        emailsGenerated: 3,
      },
      { now: NOW, focus: [a] },
    );
    expect(s.totals.totalLeads).toBe(4);
    expect(s.totals.wonLeads).toBe(1);
    expect(s.totals.emailsGenerated).toBe(3);
    expect(s.followups.due_or_overdue).toHaveLength(1);
    expect(s.followups.due_or_overdue[0].lead).toBe('Arjun Rao (Kite)');
    expect(s.leads.map((l) => l.company)).not.toContain('Orbit');
    expect(s.focus_leads[0].recent_activity[0].description).toBe('Call went well');
    expect(s.leads_note).toBeUndefined();
  });
});
