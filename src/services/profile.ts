import type { AiConversation, Profile } from '../../shared/types';
import { supabase } from '../lib/supabase';
import { unwrap } from './db';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile | null) ?? null;
}

export type ProfilePatch = Partial<
  Pick<
    Profile,
    | 'full_name'
    | 'company_name'
    | 'job_title'
    | 'product_name'
    | 'product_description'
    | 'target_customer'
    | 'value_proposition'
    | 'default_tone'
    | 'onboarding_completed'
  >
>;

export async function upsertProfile(userId: string, patch: ProfilePatch): Promise<Profile> {
  return unwrap(await supabase.from('profiles').upsert({ id: userId, ...patch }).select('*').single()) as Profile;
}

export async function listConversations(): Promise<AiConversation[]> {
  return unwrap(
    await supabase.from('ai_conversations').select('*').order('updated_at', { ascending: false }).limit(50),
  ) as AiConversation[];
}

export async function deleteConversation(id: string): Promise<void> {
  unwrap(await supabase.from('ai_conversations').delete().eq('id', id));
}
