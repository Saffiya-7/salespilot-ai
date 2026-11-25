import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Only the PUBLIC (anon / publishable) key belongs in the browser.
// Row Level Security in the database protects every table.
// Never put the service-role / secret key in any VITE_ variable.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const key = (
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
)?.trim();

function decodeJwtPayload(k: string): string {
  try {
    const part = k.split('.')[1];
    return part ? atob(part.replace(/-/g, '+').replace(/_/g, '/')) : '';
  } catch {
    return '';
  }
}

/** A human-readable reason the Supabase config can't be used, or null when it is fine. */
export const supabaseConfigProblem: string | null = !url || !key
  ? 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set.'
  : /^sb_secret_/.test(key) || /"role"\s*:\s*"service_role"/.test(decodeJwtPayload(key))
    ? 'The browser is configured with a Supabase SECRET (service-role) key. Replace it with the anon / publishable key and rotate the secret key in Supabase.'
    : !/^https?:\/\//.test(url)
      ? 'VITE_SUPABASE_URL must start with https://'
      : null;

export const isSupabaseConfigured = supabaseConfigProblem === null;

export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? (url as string) : 'http://localhost:54321',
  isSupabaseConfigured ? (key as string) : 'not-configured',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);
