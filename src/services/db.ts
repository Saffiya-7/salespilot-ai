import type { PostgrestError } from '@supabase/supabase-js';

/** Convert a Supabase/Postgres error into a message a user can act on. */
export function friendlyDbError(error: PostgrestError | { message: string; code?: string }): Error {
  const code = (error as PostgrestError).code;
  const msg = error.message ?? '';
  if (code === '23505' && /leads_user_email_unique/.test(msg)) return new Error('A lead with this e-mail address already exists.');
  if (code === '23505') return new Error('This record already exists.');
  if (code === '23514') return new Error('Some values are not allowed. Please check the form and try again.');
  if (code === '42501' || /row-level security/i.test(msg)) return new Error('You do not have permission to do that. Please sign in again.');
  if (code === '42P01' || code === 'PGRST205' || /Could not find the table/i.test(msg)) {
    return new Error('Database tables are missing. Run the SQL migration from supabase/migrations (see README, step 2).');
  }
  if (/Failed to fetch|NetworkError/i.test(msg)) return new Error('Could not reach the database. Check your internet connection.');
  if (/JWT expired|invalid JWT/i.test(msg)) return new Error('Your session expired. Please sign in again.');
  return new Error(msg || 'Database request failed.');
}

export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw friendlyDbError(res.error);
  return res.data as T;
}
