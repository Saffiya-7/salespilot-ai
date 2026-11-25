import type { PipelineStage } from '../../shared/constants';
import type { LeadParsed } from '../../shared/schemas';
import type { Lead, LeadInput, LeadScore } from '../../shared/types';
import { supabase } from '../lib/supabase';
import { logActivity } from './activities';
import { unwrap } from './db';

const LEAD_KEYS: (keyof LeadInput)[] = [
  'contact_name', 'email', 'phone', 'job_title', 'company', 'website', 'industry', 'company_size',
  'location', 'source', 'status', 'budget', 'requirements', 'notes', 'deal_value', 'last_contacted_at', 'next_follow_up_at',
];

/** Date-only or datetime-local strings → ISO timestamps; blank → null. */
export function toIsoOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T09:00:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Turn validated form values into a DB row. Blank optional fields become NULL so edits can clear them. */
export function toLeadRow(parsed: LeadParsed): LeadInput {
  const row = {} as Record<string, unknown>;
  for (const k of LEAD_KEYS) row[k] = (parsed as Record<string, unknown>)[k] ?? null;
  row.last_contacted_at = toIsoOrNull(parsed.last_contacted_at);
  row.next_follow_up_at = toIsoOrNull(parsed.next_follow_up_at);
  return row as unknown as LeadInput;
}

export async function listLeads(): Promise<Lead[]> {
  // Paginate so accounts with many leads still load completely.
  const pageSize = 1000;
  const out: Lead[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = unwrap(
      await supabase.from('leads').select('*').order('created_at', { ascending: false }).range(from, from + pageSize - 1),
    ) as Lead[];
    out.push(...page);
    if (page.length < pageSize || out.length >= 20000) break;
  }
  return out;
}

export async function getLead(id: string): Promise<Lead> {
  return unwrap(await supabase.from('leads').select('*').eq('id', id).single()) as Lead;
}

export async function createLead(parsed: LeadParsed): Promise<Lead> {
  const lead = unwrap(await supabase.from('leads').insert(toLeadRow(parsed)).select('*').single()) as Lead;
  await logActivity('lead_created', `Added ${lead.contact_name} (${lead.company})`, lead.id, { source: lead.source });
  return lead;
}

export async function updateLead(id: string, patch: Partial<LeadInput>, previous?: Lead): Promise<Lead> {
  const lead = unwrap(await supabase.from('leads').update(patch).eq('id', id).select('*').single()) as Lead;
  if (previous && patch.status && patch.status !== previous.status) {
    await logActivity('stage_changed', `Moved ${lead.contact_name} from ${previous.status} to ${patch.status}`, id, {
      from: previous.status,
      to: patch.status,
    });
  } else if (previous) {
    const changed = Object.keys(patch).filter(
      (k) => JSON.stringify((previous as unknown as Record<string, unknown>)[k] ?? null) !== JSON.stringify((patch as Record<string, unknown>)[k] ?? null),
    );
    if (changed.length) {
      await logActivity('lead_updated', `Updated ${changed.map((k) => k.replace(/_/g, ' ')).join(', ')}`, id, { fields: changed });
    }
  }
  return lead;
}

export async function changeStage(lead: Lead, status: PipelineStage): Promise<Lead> {
  const patch: Partial<LeadInput> = { status };
  if (status === 'Contacted' && !lead.last_contacted_at) patch.last_contacted_at = new Date().toISOString();
  return updateLead(lead.id, patch, lead);
}

export async function deleteLead(id: string): Promise<void> {
  unwrap(await supabase.from('leads').delete().eq('id', id));
}

/** Insert many leads in chunks. Returns how many were inserted and any chunk errors. */
export async function bulkInsertLeads(rows: LeadParsed[], onProgress?: (done: number) => void): Promise<{ inserted: number; errors: string[] }> {
  const chunk = 200;
  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk).map(toLeadRow);
    const { data, error } = await supabase.from('leads').insert(slice).select('id');
    if (error) {
      // One bad row fails the whole chunk; retry that chunk row-by-row so good rows still import.
      for (const [j, row] of slice.entries()) {
        const single = await supabase.from('leads').insert(row);
        if (single.error) errors.push(`Row ${i + j + 1} (${row.contact_name}, ${row.company}): ${single.error.code === '23505' ? 'duplicate e-mail' : single.error.message}`);
        else inserted++;
      }
    } else {
      inserted += data?.length ?? 0;
    }
    onProgress?.(Math.min(rows.length, i + chunk));
  }
  if (inserted > 0) await logActivity('import', `Imported ${inserted} lead${inserted === 1 ? '' : 's'} from CSV`, null, { inserted });
  return { inserted, errors };
}

export async function listScores(leadId: string): Promise<LeadScore[]> {
  return unwrap(
    await supabase.from('lead_scores').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(20),
  ) as LeadScore[];
}
