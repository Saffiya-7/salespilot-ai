// Calls our Netlify Functions at /api/* with the user's Supabase access token.
import { supabase } from './supabase';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
  get isConfigError() {
    return this.code === 'AI_NOT_CONFIGURED' || this.code === 'SERVER_NOT_CONFIGURED';
  }
}

const TIMEOUT_MS = 65_000;

export async function callFunction<T>(name: string, body?: unknown, init: { method?: 'GET' | 'POST' } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in again.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`/api/${name}`, {
      method: init.method ?? 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: (init.method ?? 'POST') === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new ApiError(504, 'TIMEOUT', 'The AI took too long to respond. Please try again.');
    throw new ApiError(0, 'NETWORK', 'Could not reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    if (!err && res.status === 404) {
      throw new ApiError(404, 'FUNCTIONS_UNAVAILABLE', 'AI functions are not reachable. Locally, run the app with "npm run dev" (see README).');
    }
    throw new ApiError(res.status, err?.code ?? 'HTTP_ERROR', err?.message ?? `Request failed (${res.status}).`);
  }
  if (payload === null) {
    throw new ApiError(502, 'FUNCTIONS_UNAVAILABLE', 'The AI service returned an empty response. Please try again.');
  }
  return payload as T;
}
