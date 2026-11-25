import type { Lead } from '../../shared/types';

export interface LeadFilters {
  q: string;
  stage: string; // '' = any
  industry: string;
  score: '' | 'Hot' | 'Warm' | 'Cold' | 'unscored';
  source: string;
}

export const EMPTY_FILTERS: LeadFilters = { q: '', stage: '', industry: '', score: '', source: '' };

export function filterLeads(leads: Lead[], f: LeadFilters): Lead[] {
  const q = f.q.trim().toLowerCase();
  return leads.filter((l) => {
    if (q && ![l.contact_name, l.company, l.email, l.industry, l.job_title, l.location].some((v) => v?.toLowerCase().includes(q))) return false;
    if (f.stage && l.status !== f.stage) return false;
    if (f.industry && (l.industry ?? '').toLowerCase() !== f.industry.toLowerCase()) return false;
    if (f.source && l.source !== f.source) return false;
    if (f.score === 'unscored' && l.score !== null) return false;
    if (f.score && f.score !== 'unscored' && l.score_label !== f.score) return false;
    return true;
  });
}

export function uniqueIndustries(leads: Lead[]): string[] {
  const map = new Map<string, string>();
  for (const l of leads) {
    const v = l.industry?.trim();
    if (v && !map.has(v.toLowerCase())) map.set(v.toLowerCase(), v);
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b));
}

export type SortKey = 'created_desc' | 'created_asc' | 'score_desc' | 'name_asc' | 'company_asc' | 'value_desc';

export function sortLeads(leads: Lead[], key: SortKey): Lead[] {
  const arr = [...leads];
  switch (key) {
    case 'created_asc':
      return arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case 'score_desc':
      return arr.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    case 'name_asc':
      return arr.sort((a, b) => a.contact_name.localeCompare(b.contact_name));
    case 'company_asc':
      return arr.sort((a, b) => a.company.localeCompare(b.company));
    case 'value_desc':
      return arr.sort((a, b) => (b.deal_value ?? -1) - (a.deal_value ?? -1));
    default:
      return arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}
