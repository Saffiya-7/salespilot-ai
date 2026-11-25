import type { Followup, Lead, SalesActivity } from '../shared/types';

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

export function makeLead(p: Partial<Lead> = {}): Lead {
  const created = p.created_at ?? '2026-11-10T10:00:00.000Z';
  return {
    id: id(),
    user_id: 'u1',
    contact_name: 'Test Person',
    email: null,
    phone: null,
    job_title: null,
    company: 'Acme',
    website: null,
    industry: null,
    company_size: null,
    location: null,
    source: 'Other',
    status: 'New Lead',
    budget: null,
    requirements: null,
    notes: null,
    deal_value: null,
    score: null,
    score_label: null,
    scored_at: null,
    research: null,
    researched_at: null,
    last_contacted_at: null,
    next_follow_up_at: null,
    status_changed_at: created,
    created_at: created,
    updated_at: created,
    ...p,
  };
}

export function makeFollowup(p: Partial<Followup> = {}): Followup {
  return {
    id: id(),
    user_id: 'u1',
    lead_id: 'lead',
    due_at: '2026-11-25T09:00:00.000Z',
    channel: 'email',
    status: 'pending',
    note: null,
    message: null,
    completed_at: null,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    ...p,
  };
}

export function makeActivity(p: Partial<SalesActivity> = {}): SalesActivity {
  return {
    id: id(),
    user_id: 'u1',
    lead_id: null,
    type: 'note',
    description: 'x',
    metadata: {},
    created_at: '2026-11-20T10:00:00.000Z',
    ...p,
  };
}
