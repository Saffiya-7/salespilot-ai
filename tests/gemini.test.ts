import { Type } from '@google/genai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { extractJson, generateJson, isRetryable, toHttpError, type RawGenerate } from '../netlify/lib/gemini';
import { HttpError } from '../netlify/lib/http';
import { SlidingWindowLimiter } from '../netlify/lib/rateLimit';

const schema = { type: Type.OBJECT, properties: { answer: { type: Type.STRING } }, required: ['answer'] };
const validator = z.object({ answer: z.string().min(1) });
const noSleep = async () => {};

function scripted(...steps: (string | Error)[]): RawGenerate & { calls: { prompt: string }[] } {
  const calls: { prompt: string }[] = [];
  const fn = (async (req) => {
    calls.push({ prompt: req.prompt });
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    if (step instanceof Error) throw step;
    return step;
  }) as RawGenerate & { calls: { prompt: string }[] };
  fn.calls = calls;
  return fn;
}

const httpErr = (status: number, message = `HTTP ${status}`) => Object.assign(new Error(message), { status });

describe('extractJson', () => {
  it('handles plain JSON, code fences and surrounding text', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(extractJson('Here you go: {"a":3} thanks')).toEqual({ a: 3 });
    expect(() => extractJson('no json here')).toThrow();
  });
});

describe('generateJson', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_MODEL', 'test-model');
    vi.stubEnv('GEMINI_FALLBACK_MODEL', 'test-model'); // same model: tests below exercise plain retries
  });
  afterEach(() => vi.unstubAllEnvs());

  it('returns validated data and the model name', async () => {
    const gen = scripted('{"answer":"hi"}');
    await expect(generateJson({ system: 's', prompt: 'p', schema, validator, generate: gen, sleep: noSleep })).resolves.toEqual({ data: { answer: 'hi' }, model: 'test-model' });
  });

  it('retries transient errors (429/5xx) with backoff, then succeeds', async () => {
    const gen = scripted(httpErr(503), httpErr(429), '{"answer":"ok"}');
    const sleep = vi.fn(noSleep);
    const r = await generateJson({ system: 's', prompt: 'p', schema, validator, generate: gen, sleep });
    expect(r.data.answer).toBe('ok');
    expect(gen.calls).toHaveLength(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry budget with a safe error', async () => {
    const gen = scripted(httpErr(503));
    await expect(generateJson({ system: 's', prompt: 'p', schema, validator, generate: gen, sleep: noSleep, retries: 2 })).rejects.toMatchObject({ status: 502, code: 'AI_UNAVAILABLE' });
    expect(gen.calls).toHaveLength(3);
  });

  it('falls back to the second model when the first is overloaded', async () => {
    vi.stubEnv('GEMINI_FALLBACK_MODEL', 'backup-model');
    const used: string[] = [];
    const gen: RawGenerate = async (req) => {
      used.push(req.model);
      if (req.model === 'test-model') throw httpErr(503, 'This model is currently experiencing high demand.');
      return '{"answer":"from backup"}';
    };
    const sleep = vi.fn(noSleep);
    const r = await generateJson({ system: 's', prompt: 'p', schema, validator, generate: gen, sleep });
    expect(r).toEqual({ data: { answer: 'from backup' }, model: 'backup-model' });
    expect(used).toEqual(['test-model', 'backup-model']);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('caps each attempt so the whole call fits the function time limit', async () => {
    const timeouts: number[] = [];
    const gen: RawGenerate = async (req) => {
      timeouts.push(req.timeoutMs);
      return '{"answer":"ok"}';
    };
    await generateJson({ system: 's', prompt: 'p', schema, validator, generate: gen, sleep: noSleep });
    expect(timeouts[0]).toBeLessThanOrEqual(14_000);
  });

  it('re-asks once when the response does not match the schema', async () => {
    const gen = scripted('{"wrong":true}', '{"answer":"fixed"}');
    const r = await generateJson({ system: 's', prompt: 'p', schema, validator, generate: gen, sleep: noSleep });
    expect(r.data.answer).toBe('fixed');
    expect(gen.calls[1].prompt).toMatch(/did not match the required JSON schema/);
  });

  it('never returns a fake answer: invalid twice → AI_INVALID_RESPONSE', async () => {
    const gen = scripted('not json', '{"answer":""}');
    await expect(generateJson({ system: 's', prompt: 'p', schema, validator, generate: gen, sleep: noSleep })).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
  });

  it('does not retry auth/config errors', async () => {
    const gen = scripted(httpErr(403, 'Permission denied'));
    await expect(generateJson({ system: 's', prompt: 'p', schema, validator, generate: gen, sleep: noSleep })).rejects.toMatchObject({ status: 503, code: 'AI_NOT_CONFIGURED' });
    expect(gen.calls).toHaveLength(1);
  });

  it('passes HttpErrors (e.g. safety blocks) straight through', async () => {
    const gen = scripted(new HttpError(422, 'AI_BLOCKED', 'blocked'));
    await expect(generateJson({ system: 's', prompt: 'p', schema, validator, generate: gen, sleep: noSleep })).rejects.toMatchObject({ code: 'AI_BLOCKED' });
  });
});

describe('error mapping', () => {
  it('classifies retryable errors', () => {
    expect(isRetryable(httpErr(429))).toBe(true);
    expect(isRetryable(httpErr(500))).toBe(true);
    expect(isRetryable(new Error('fetch failed'))).toBe(true);
    expect(isRetryable(httpErr(400))).toBe(false);
    expect(isRetryable(new HttpError(503, 'AI_NOT_CONFIGURED', 'x'))).toBe(false);
  });
  it('maps provider errors to user-safe messages', () => {
    expect(toHttpError(httpErr(400, 'API key not valid. Please pass a valid API key.')).code).toBe('AI_NOT_CONFIGURED');
    expect(toHttpError(httpErr(404)).message).toMatch(/GEMINI_MODEL/);
    expect(toHttpError(httpErr(429)).status).toBe(429);
    const generic = toHttpError(new Error('internal stack trace with secrets'));
    expect(generic.message).not.toMatch(/stack|secret/);
  });
});

describe('SlidingWindowLimiter', () => {
  it('allows up to the limit per window, then reports retry-after', () => {
    const l = new SlidingWindowLimiter(2, 60_000);
    expect(l.check('u', 0).allowed).toBe(true);
    expect(l.check('u', 1_000).allowed).toBe(true);
    const blocked = l.check('u', 2_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(58);
    expect(l.check('other', 2_000).allowed).toBe(true); // per user
    expect(l.check('u', 61_000).allowed).toBe(true); // window slid
  });
});
