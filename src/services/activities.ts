import type { ActivityType } from '../../shared/constants';
import type { SalesActivity } from '../../shared/types';
import { supabase } from '../lib/supabase';
import { unwrap } from './db';

export async function listActivities(opts: { leadId?: string; limit?: number } = {}): Promise<SalesActivity[]> {
  let q = supabase.from('sales_activities').select('*').order('created_at', { ascending: false }).limit(opts.limit ?? 500);
  if (opts.leadId) q = q.eq('lead_id', opts.leadId);
  return unwrap(await q) as SalesActivity[];
}

/** Record a timeline entry. Failures are logged but never block the main action. */
export async function logActivity(
  type: ActivityType,
  description: string,
  leadId: string | null = null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase
    .from('sales_activities')
    .insert({ type, description: description.slice(0, 1000), lead_id: leadId, metadata });
  if (error) console.warn('Could not record activity', error.message);
}

export async function addNote(leadId: string, type: 'note' | 'call' | 'meeting', description: string): Promise<void> {
  unwrap(await supabase.from('sales_activities').insert({ type, description: description.slice(0, 1000), lead_id: leadId }));
}
