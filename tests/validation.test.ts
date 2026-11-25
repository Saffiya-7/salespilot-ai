import { describe, expect, it } from 'vitest';
import {
  assistantRequestSchema,
  emailRequestSchema,
  followupRequestSchema,
  formatZodError,
  insightsRequestSchema,
  isLikelyWebsite,
  leadInputSchema,
  researchRequestSchema,
  scoreRequestSchema,
} from '../shared/schemas';
import { HttpError, readJson } from '../netlify/lib/http';

const UUID = '3f2a6c1e-8b7d-4e2a-9c1f-0a1b2c3d4e5f';

describe('function input validation', () => {
  it('research-company requires a company name and checks the website', () => {
    expect(researchRequestSchema.safeParse({}).success).toBe(false);
    expect(researchRequestSchema.safeParse({ company_name: '   ' }).success).toBe(false);
    const bad = researchRequestSchema.safeParse({ company_name: 'Acme', website: 'javascript:alert(1)' });
    expect(bad.success).toBe(false);
    const ok = researchRequestSchema.parse({ company_name: ' Acme ', website: 'acme.com', industry: '' });
    expect(ok.company_name).toBe('Acme');
    expect(ok.industry).toBeUndefined();
    expect(ok.use_live_search).toBe(false);
  });

  it('rejects oversized text', () => {
    expect(researchRequestSchema.safeParse({ company_name: 'A', description: 'x'.repeat(4001) }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ message: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('score-lead / follow-up need valid UUIDs', () => {
    expect(scoreRequestSchema.safeParse({ lead_id: 'abc' }).success).toBe(false);
    expect(scoreRequestSchema.safeParse({ lead_id: UUID }).success).toBe(true);
    expect(followupRequestSchema.parse({ lead_id: UUID }).tone).toBe('Professional');
    expect(followupRequestSchema.safeParse({ lead_id: UUID, tone: 'Rude' }).success).toBe(false);
  });

  it('generate-email validates tone, required fields and the existing e-mail for edits', () => {
    const base = { prospect_name: 'Priya', company: 'Northwind', product: 'FlowDesk' };
    expect(emailRequestSchema.parse(base)).toMatchObject({ action: 'generate', tone: 'Professional' });
    expect(emailRequestSchema.safeParse({ ...base, product: '' }).success).toBe(false);
    expect(emailRequestSchema.safeParse({ ...base, tone: 'Aggressive' }).success).toBe(false);
    const rewriteMissing = emailRequestSchema.safeParse({ ...base, action: 'shorten' });
    expect(rewriteMissing.success).toBe(false);
    expect(formatZodError(rewriteMissing.error!)).toMatch(/existing/);
    expect(emailRequestSchema.safeParse({ ...base, action: 'shorten', existing: { subject: 'Hi', body: 'Body' } }).success).toBe(true);
  });

  it('assistant and insights defaults', () => {
    expect(assistantRequestSchema.safeParse({ message: '' }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ message: 'hi', conversation_id: 'nope' }).success).toBe(false);
    expect(insightsRequestSchema.parse({}).scope).toBe('dashboard');
    expect(insightsRequestSchema.safeParse({ scope: 'all' }).success).toBe(false);
  });
});

describe('lead form validation', () => {
  it('turns blanks into undefined and parses deal values', () => {
    const r = leadInputSchema.parse({ contact_name: 'Ann', company: 'Co', email: '', deal_value: '12,500.50', company_size: '' });
    expect(r.email).toBeUndefined();
    expect(r.company_size).toBeUndefined();
    expect(r.deal_value).toBe(12500.5);
    expect(r.status).toBe('New Lead');
  });
  it('rejects invalid values', () => {
    expect(leadInputSchema.safeParse({ contact_name: 'Ann', company: 'Co', email: 'nope' }).success).toBe(false);
    expect(leadInputSchema.safeParse({ contact_name: 'Ann', company: 'Co', deal_value: '-5' }).success).toBe(false);
    expect(leadInputSchema.safeParse({ contact_name: 'Ann', company: 'Co', status: 'Maybe' }).success).toBe(false);
    expect(leadInputSchema.safeParse({ contact_name: '', company: 'Co' }).success).toBe(false);
  });
  it('website check', () => {
    expect(isLikelyWebsite('acme.com')).toBe(true);
    expect(isLikelyWebsite('https://sub.acme.co.uk/path')).toBe(true);
    expect(isLikelyWebsite('localhost')).toBe(false);
    expect(isLikelyWebsite('ftp://acme.com')).toBe(false);
  });
});

describe('readJson (server request parsing)', () => {
  const req = (body: string, headers: Record<string, string> = {}) =>
    new Request('http://x/api/test', { method: 'POST', body, headers: { 'content-type': 'application/json', ...headers } });

  it('parses and validates JSON bodies', async () => {
    await expect(readJson(req(JSON.stringify({ lead_id: UUID })), scoreRequestSchema)).resolves.toEqual({ lead_id: UUID });
  });
  it('returns 400 for malformed JSON or invalid data', async () => {
    await expect(readJson(req('{oops'), scoreRequestSchema)).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST' });
    await expect(readJson(req('{"lead_id":1}'), scoreRequestSchema)).rejects.toBeInstanceOf(HttpError);
  });
  it('returns 413 for oversized bodies', async () => {
    const big = JSON.stringify({ message: 'x'.repeat(40_000) });
    await expect(readJson(req(big), assistantRequestSchema)).rejects.toMatchObject({ status: 413 });
  });
});
