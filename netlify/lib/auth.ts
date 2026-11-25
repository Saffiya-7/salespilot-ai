// Verifies the caller's Supabase session and returns a Supabase client that
// acts AS that user, so Row Level Security applies to every query the
// function makes. No service-role key is needed or used anywhere.
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { HttpError, env } from './http';

export interface AuthContext {
  user: User;
  supabase: SupabaseClient;
}

export function supabaseConfig(): { url: string; key: string } | null {
  const url = env('SUPABASE_URL') ?? env('VITE_SUPABASE_URL');
  const key =
    env('SUPABASE_ANON_KEY') ??
    env('SUPABASE_PUBLISHABLE_KEY') ??
    env('VITE_SUPABASE_PUBLISHABLE_KEY') ??
    env('VITE_SUPABASE_ANON_KEY');
  return url && key ? { url, key } : null;
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

export async function requireUser(req: Request): Promise<AuthContext> {
  const cfg = supabaseConfig();
  if (!cfg) {
    throw new HttpError(503, 'SERVER_NOT_CONFIGURED', 'Supabase is not configured on the server. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the Netlify environment variables.');
  }
  const token = bearerToken(req);
  if (!token || token.length > 4096) throw new HttpError(401, 'UNAUTHORIZED', 'Please sign in again.');

  const supabase = createClient(cfg.url, cfg.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // getUser() asks Supabase Auth to validate the JWT (signature, expiry, revocation).
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.');
  return { user: data.user, supabase };
}
