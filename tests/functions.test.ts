// Tests the shared function pipeline (method → JWT → validation → AI config →
// rate limit) with a mocked Supabase client. No network calls are made.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ validToken: 'good-token', logCount: 0, inserts: [] as unknown[] }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) =>
        token === state.validToken ? { data: { user: { id: 'user-1' } }, error: null } : { data: { user: null }, error: { message: 'invalid JWT' } },
    },
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        gte: () => Promise.resolve({ count: state.logCount, error: null }),
        insert: (row: unknown) => {
          state.inserts.push({ table, row });
          return Promise.resolve({ error: null });
        },
      };
      return q;
    },
  }),
}));

const { createHandler } = await import('../netlify/lib/handler');
const { scoreRequestSchema } = await import('../shared/schemas');
const aiStatus = (await import('../netlify/functions/ai-status')).default;

const UUID = '3f2a6c1e-8b7d-4e2a-9c1f-0a1b2c3d4e5f';
const handler = createHandler('score-lead', { schema: scoreRequestSchema }, async (input) => ({ ok: true, input }));

function call(fn: (r: Request) => Promise<Response>, init: { method?: string; token?: string | null; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.token !== null) headers.authorization = `Bearer ${init.token ?? state.validToken}`;
  return fn(
    new Request('http://localhost/api/score-lead', {
      method: init.method ?? 'POST',
      headers,
      body: (init.method ?? 'POST') === 'POST' ? JSON.stringify(init.body ?? { lead_id: UUID }) : undefined,
    }),
  );
}

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  state.logCount = 0;
  state.inserts = [];
});
afterEach(() => vi.unstubAllEnvs());

describe('function pipeline', () => {
  it('rejects the wrong HTTP method', async () => {
    const res = await call(handler, { method: 'GET' });
    expect(res.status).toBe(405);
  });

  it('requires a valid Supabase session token', async () => {
    expect((await call(handler, { token: null })).status).toBe(401);
    const res = await call(handler, { token: 'forged' });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
  });

  it('explains when Supabase is not configured on the server', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    const res = await call(handler);
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('SERVER_NOT_CONFIGURED');
  });

  it('validates input before spending rate-limit quota', async () => {
    const res = await call(handler, { body: { lead_id: 'not-a-uuid' } });
    expect(res.status).toBe(400);
    expect(state.inserts).toHaveLength(0);
  });

  it('returns a clear configuration message when GEMINI_API_KEY is missing (no fake AI output)', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const res = await call(handler);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('AI_NOT_CONFIGURED');
    expect(body.error.message).toMatch(/GEMINI_API_KEY/);
    expect(body.ok).toBeUndefined();
  });

  it('enforces the per-user rate limit from the request log', async () => {
    state.logCount = 999;
    const res = await call(handler);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });

  it('runs the handler and logs the request when everything is valid', async () => {
    const res = await call(handler);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, input: { lead_id: UUID } });
    expect(state.inserts).toEqual([{ table: 'ai_request_log', row: { user_id: 'user-1', endpoint: 'score-lead' } }]);
  });

  it('hides unexpected internal errors', async () => {
    const boom = createHandler('x', { ai: false }, async () => {
      throw new Error('db password=hunter2');
    });
    const res = await call(boom);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/hunter2/);
  });

  it('ai-status reports configuration without exposing secrets', async () => {
    const res = await call(aiStatus, { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.gemini_configured).toBe(true);
    expect(body.email_sending).toBe('not_configured');
    expect(JSON.stringify(body)).not.toMatch(/test-key|anon/);
  });
});
