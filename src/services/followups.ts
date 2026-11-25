import type { FollowupChannel } from '../../shared/constants';
import type { Followup, Lead } from '../../shared/types';
import { supabase } from '../lib/supabase';
import { logActivity } from './activities';
import { unwrap } from './db';

export async function listFollowups(opts: { leadId?: string } = {}): Promise<Followup[]> {
  let q = supabase.from('followups').select('*').order('due_at', { ascending: true }).limit(2000);
  if (opts.leadId) q = q.eq('lead_id', opts.leadId);
  return unwrap(await q) as Followup[];
}

/** Keep leads.next_follow_up_at equal to the earliest pending follow-up for that lead. */
export async function syncNextFollowUp(leadId: string): Promise<void> {
  const { data } = await supabase
    .from('followups')
    .select('due_at')
    .eq('lead_id', leadId)
    .eq('status', 'pending')
    .order('due_at', { ascending: true })
    .limit(1);
  const next = data?.[0]?.due_at ?? null;
  await supabase.from('leads').update({ next_follow_up_at: next }).eq('id', leadId);
}

export async function createFollowup(input: {
  lead: Pick<Lead, 'id' | 'contact_name'>;
  due_at: string;
  channel: FollowupChannel;
  note?: string;
  message?: string;
}): Promise<Followup> {
  const row = unwrap(
    await supabase
      .from('followups')
      .insert({
        lead_id: input.lead.id,
        due_at: input.due_at,
        channel: input.channel,
        note: input.note?.trim() || null,
        message: input.message?.trim() || null,
      })
      .select('*')
      .single(),
  ) as Followup;
  await syncNextFollowUp(input.lead.id);
  await logActivity(
    'followup_scheduled',
    `Scheduled ${input.channel} follow-up with ${input.lead.contact_name} for ${new Date(input.due_at).toLocaleDateString()}`,
    input.lead.id,
    { followup_id: row.id },
  );
  return row;
}

export async function completeFollowup(f: Followup, lead: Pick<Lead, 'id' | 'contact_name' | 'status'>, outcome?: string): Promise<void> {
  const now = new Date().toISOString();
  unwrap(
    await supabase
      .from('followups')
      .update({ status: 'completed', completed_at: now, note: outcome?.trim() ? outcome.trim() : f.note })
      .eq('id', f.id),
  );
  const leadPatch: Record<string, unknown> = { last_contacted_at: now };
  if (lead.status === 'New Lead') leadPatch.status = 'Contacted';
  unwrap(await supabase.from('leads').update(leadPatch).eq('id', lead.id));
  await syncNextFollowUp(lead.id);
  await logActivity('followup_completed', `Completed ${f.channel} follow-up with ${lead.contact_name}${outcome ? `: ${outcome}` : ''}`, lead.id, {
    followup_id: f.id,
  });
}

export async function updateFollowup(id: string, patch: Partial<Pick<Followup, 'due_at' | 'channel' | 'note' | 'message' | 'status'>>, leadId?: string): Promise<void> {
  unwrap(await supabase.from('followups').update(patch).eq('id', id));
  if (leadId && (patch.due_at || patch.status)) await syncNextFollowUp(leadId);
}

export async function deleteFollowup(id: string, leadId: string): Promise<void> {
  unwrap(await supabase.from('followups').delete().eq('id', id));
  await syncNextFollowUp(leadId);
}
