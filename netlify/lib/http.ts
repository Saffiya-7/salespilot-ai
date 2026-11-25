// Small HTTP helpers for Netlify Functions (Web Request/Response API).
import type { z } from 'zod';
import { LIMITS } from '../../shared/constants';
import { formatZodError } from '../../shared/schemas';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'AI_NOT_CONFIGURED'
  | 'SERVER_NOT_CONFIGURED'
  | 'AI_UNAVAILABLE'
  | 'AI_INVALID_RESPONSE'
  | 'AI_BLOCKED'
  | 'INTERNAL';

/** An error whose message is safe to show to the user. */
export class HttpError extends Error {
  status: number;
  code: ErrorCode;
  retryAfter?: number;
  constructor(status: number, code: ErrorCode, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

const baseHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...baseHeaders, ...extra } });
}

export function errorResponse(err: unknown, fnName: string): Response {
  if (err instanceof HttpError) {
    const headers: Record<string, string> = {};
    if (err.retryAfter) headers['retry-after'] = String(err.retryAfter);
    return json({ error: { code: err.code, message: err.message } }, err.status, headers);
  }
  // Never leak internals: log server-side, return a generic message.
  console.error(`[${fnName}] unexpected error`, err);
  return json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } }, 500);
}

/** Read and validate a JSON body with a hard size limit. */
export async function readJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > LIMITS.maxRequestBytes) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request is too large.');
  const raw = await req.text();
  if (raw.length > LIMITS.maxRequestBytes) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request is too large.');
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', 'Request body must be valid JSON.');
  }
  return validate(schema, body);
}

export function validate<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, 'BAD_REQUEST', formatZodError(parsed.error));
  return parsed.data;
}

export function requireMethod(req: Request, ...methods: string[]): void {
  if (!methods.includes(req.method)) {
    throw new HttpError(405, 'METHOD_NOT_ALLOWED', `Use ${methods.join(' or ')}.`);
  }
}

export function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}
