import type { GeneratedEmail, Lead } from '../../shared/types';
import { supabase } from '../lib/supabase';
import { logActivity } from './activities';
import { unwrap } from './db';

export async function listEmails(opts: { savedOnly?: boolean; leadId?: string; limit?: number } = {}): Promise<GeneratedEmail[]> {
  let q = supabase.from('generated_emails').select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 200);
  if (opts.savedOnly) q = q.eq('is_saved', true);
  if (opts.leadId) q = q.eq('lead_id', opts.leadId);
  return unwrap(await q) as GeneratedEmail[];
}

export async function countEmails(): Promise<number> {
  const { count, error } = await supabase.from('generated_emails').select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function setEmailSaved(id: string, saved: boolean, edits?: { subject: string; body: string }): Promise<void> {
  unwrap(await supabase.from('generated_emails').update({ is_saved: saved, ...(edits ?? {}) }).eq('id', id));
}

export async function deleteEmail(id: string): Promise<void> {
  unwrap(await supabase.from('generated_emails').delete().eq('id', id));
}

/**
 * The user sent this e-mail themselves (from their own mail client).
 * Sumo never sends e-mail on its own; this only records it.
 */
export async function markEmailSent(email: Pick<GeneratedEmail, 'id' | 'subject'>, lead: Pick<Lead, 'id' | 'contact_name' | 'status'>): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { last_contacted_at: now };
  if (lead.status === 'New Lead') patch.status = 'Contacted';
  unwrap(await supabase.from('leads').update(patch).eq('id', lead.id));
  await logActivity('email_sent', `You sent "${email.subject}" to ${lead.contact_name}`, lead.id, { email_id: email.id });
}
