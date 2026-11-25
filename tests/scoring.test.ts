import { describe, expect, it } from 'vitest';
import { scoreAiSchema, type ScoreAi } from '../shared/schemas';
import { cleanList, labelForScore, leadCompleteness, normalizeScore } from '../shared/scoring';
import { normalizeUrl, sanitizeResearch } from '../shared/research';
import type { ResearchAi } from '../shared/schemas';

const factor = (score: number) => ({ score, reason: 'r' });
const baseAi = (over: Partial<ScoreAi> = {}): ScoreAi => ({
  score: 80,
  label: 'Hot',
  explanation: 'Good fit.',
  factors: {
    industry_relevance: factor(8),
    company_size: factor(7),
    requirements: factor(9),
    budget_indicators: factor(5),
    decision_maker_relevance: factor(8),
    product_fit: factor(9),
    engagement: factor(3),
  },
  positive_indicators: ['Clear need'],
  risk_factors: ['No budget info'],
  next_action: 'Book a call',
  data_completeness: 'medium',
  ...over,
});

describe('labelForScore', () => {
  it('uses the Hot/Warm/Cold thresholds', () => {
    expect(labelForScore(100)).toBe('Hot');
    expect(labelForScore(75)).toBe('Hot');
    expect(labelForScore(74)).toBe('Warm');
    expect(labelForScore(45)).toBe('Warm');
    expect(labelForScore(44)).toBe('Cold');
    expect(labelForScore(0)).toBe('Cold');
  });
});

describe('normalizeScore', () => {
  it('clamps and rounds the overall score and factors', () => {
    const r = normalizeScore(
      baseAi({ score: 130.6, factors: { ...baseAi().factors, engagement: factor(14), budget_indicators: factor(-3), product_fit: factor(6.6) } }),
    );
    expect(r.score).toBe(100);
    expect(r.factors.engagement.score).toBe(10);
    expect(r.factors.budget_indicators.score).toBe(0);
    expect(r.factors.product_fit.score).toBe(7);
  });

  it('always derives the label from the score (ignores a contradictory model label)', () => {
    expect(normalizeScore(baseAi({ score: 30, label: 'Hot' })).label).toBe('Cold');
    expect(normalizeScore(baseAi({ score: 60, label: 'Cold' })).label).toBe('Warm');
    expect(normalizeScore(baseAi({ score: Number.NaN })).score).toBe(0);
  });

  it('de-duplicates and caps indicator lists', () => {
    const r = normalizeScore(baseAi({ positive_indicators: ['A', 'a ', ' A', 'B', 'C', 'D', 'E', 'F', 'G'] }));
    expect(r.positive_indicators).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
  });
});

describe('scoreAiSchema (AI response validation)', () => {
  it('accepts a complete response', () => {
    expect(scoreAiSchema.safeParse(baseAi()).success).toBe(true);
  });
  it('rejects responses with missing factors or fields', () => {
    const missingFactor = { ...baseAi(), factors: { ...baseAi().factors } } as Record<string, unknown>;
    delete (missingFactor.factors as Record<string, unknown>).engagement;
    expect(scoreAiSchema.safeParse(missingFactor).success).toBe(false);
    const { next_action: _omit, ...noAction } = baseAi();
    void _omit;
    expect(scoreAiSchema.safeParse(noAction).success).toBe(false);
    expect(scoreAiSchema.safeParse({ ...baseAi(), score: '80' }).success).toBe(false);
    expect(scoreAiSchema.safeParse({ ...baseAi(), data_completeness: 'very' }).success).toBe(false);
  });
});

describe('cleanList / leadCompleteness', () => {
  it('normalises whitespace', () => {
    expect(cleanList(['  a   b ', 'A B', ''], 5)).toEqual(['a b']);
  });
  it('measures how many optional fields are filled', () => {
    expect(leadCompleteness({})).toBe(0);
    expect(leadCompleteness({ email: 'a@b.c', industry: 'SaaS', budget: '  ' })).toBeCloseTo(2 / 9);
  });
});

const researchAi = (over: Partial<ResearchAi> = {}): ResearchAi => ({
  company_overview: 'Overview',
  industry_classification: { primary: 'SaaS', sub_industry: '', confidence: 'medium' },
  likely_challenges: ['c1'],
  customer_needs: ['n1'],
  product_use_cases: ['u1'],
  value_proposition: 'vp',
  sales_approach: 'sa',
  outreach_angle: 'oa',
  verified_information: [
    { statement: 'They sell to banks', basis: 'user_input', source_url: 'https://made-up.example' },
    { statement: 'Raised $20M last year', basis: 'web', source_url: 'https://news.example.com/acme' },
    { statement: 'Has 300 staff', basis: 'web', source_url: 'https://www.acme.com/about/' },
  ],
  ai_hypotheses: ['h1'],
  information_gaps: ['g1'],
  ...over,
});

describe('sanitizeResearch (verified vs hypothesis guard)', () => {
  it('in input-only mode, never keeps "web" facts as verified', () => {
    const r = sanitizeResearch(researchAi(), { mode: 'input_only', sources: [], model: 'm' });
    expect(r.verified_information).toEqual([{ statement: 'They sell to banks', basis: 'user_input', source_url: null }]);
    expect(r.ai_hypotheses).toContain('Unverified: Raised $20M last year');
    expect(r.ai_hypotheses).toContain('Unverified: Has 300 staff');
    expect(r.sources).toEqual([]);
    expect(r.mode).toBe('input_only');
  });

  it('in live mode, only keeps web facts whose URL was really returned by search', () => {
    const r = sanitizeResearch(researchAi(), { mode: 'live_search', sources: [{ title: 'About', url: 'https://acme.com/about' }], model: 'm' });
    const web = r.verified_information.filter((v) => v.basis === 'web');
    expect(web).toEqual([{ statement: 'Has 300 staff', basis: 'web', source_url: 'https://acme.com/about' }]);
    expect(r.ai_hypotheses).toContain('Unverified: Raised $20M last year');
    expect(r.sources).toHaveLength(1);
  });

  it('normalises URLs for comparison', () => {
    expect(normalizeUrl('https://www.Acme.com/about/#team')).toBe('acme.com/about');
    expect(normalizeUrl('acme.com')).toBe('acme.com');
  });
});
