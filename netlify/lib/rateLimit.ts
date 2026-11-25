// Per-user rate limiting for AI endpoints, in two layers:
//  1. an in-memory sliding window (cheap, per warm function instance)
//  2. a database check against public.ai_request_log (shared across all
//     instances; rows are written as the user, so RLS applies)
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError, env } from './http';

export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;
  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  check(key: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
    const since = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      const retryAfterSec = Math.max(1, Math.ceil((list[0] + this.windowMs - now) / 1000));
      return { allowed: false, retryAfterSec };
    }
    list.push(now);
    this.hits.set(key, list);
    // keep memory bounded on long-lived instances
    if (this.hits.size > 5000) {
      for (const [k, v] of this.hits) if (!v.some((t) => t > since)) this.hits.delete(k);
    }
    return { allowed: true, retryAfterSec: 0 };
  }
}

function intEnv(name: string, fallback: number): number {
  const n = Number(env(name));
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function limits() {
  return {
    perMinute: intEnv('AI_RATE_LIMIT_PER_MINUTE', 10),
    perDay: intEnv('AI_RATE_LIMIT_PER_DAY', 200),
  };
}

const memory = new SlidingWindowLimiter(limits().perMinute, 60_000);

export function isMissingTableError(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false;
  return e.code === '42P01' || e.code === 'PGRST205' || /relation .* does not exist|Could not find the table/i.test(e.message ?? '');
}

export async function enforceRateLimit(supabase: SupabaseClient, userId: string, endpoint: string): Promise<void> {
  const { perMinute, perDay } = limits();
  const mem = memory.check(userId);
  if (!mem.allowed) {
    throw new HttpError(429, 'RATE_LIMITED', `Too many AI requests. Please wait ${mem.retryAfterSec}s and try again.`, mem.retryAfterSec);
  }

  const now = Date.now();
  const minuteAgo = new Date(now - 60_000).toISOString();
  const dayAgo = new Date(now - 86_400_000).toISOString();
  const [minute, day] = await Promise.all([
    supabase.from('ai_request_log').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', minuteAgo),
    supabase.from('ai_request_log').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', dayAgo),
  ]);

  if (isMissingTableError(minute.error) || isMissingTableError(day.error)) {
    throw new HttpError(503, 'SERVER_NOT_CONFIGURED', 'The database is missing tables. Run the SQL migration in supabase/migrations (see README).');
  }
  if (minute.error || day.error) {
    // Don't block users on a transient database hiccup; the in-memory layer still applies.
    console.warn(`[rate-limit] count failed for ${endpoint}`, minute.error?.message ?? day.error?.message);
  } else {
    if ((minute.count ?? 0) >= perMinute) {
      throw new HttpError(429, 'RATE_LIMITED', 'Too many AI requests in the last minute. Please wait a moment.', 60);
    }
    if ((day.count ?? 0) >= perDay) {
      throw new HttpError(429, 'RATE_LIMITED', `Daily AI limit reached (${perDay} requests). It resets over the next 24 hours.`, 3600);
    }
  }

  const ins = await supabase.from('ai_request_log').insert({ user_id: userId, endpoint });
  if (ins.error) console.warn(`[rate-limit] log insert failed for ${endpoint}`, ins.error.message);
}
