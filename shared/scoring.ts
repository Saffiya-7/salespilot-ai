// Post-processing of AI score results. The model proposes; this code makes
// the result consistent (clamped numbers, label derived from the score,
// de-duplicated lists) before anything is shown or stored.
import { SCORE_FACTORS, SCORE_THRESHOLDS, type ScoreLabel } from './constants';
import type { ScoreAi } from './schemas';
import type { ScoreFactors, ScoreResult } from './types';

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function labelForScore(score: number): ScoreLabel {
  if (score >= SCORE_THRESHOLDS.hot) return 'Hot';
  if (score >= SCORE_THRESHOLDS.warm) return 'Warm';
  return 'Cold';
}

export function cleanList(items: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const s = raw.trim().replace(/\s+/g, ' ');
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Normalise a validated AI score:
 *  - overall score is rounded and clamped to 0–100
 *  - each factor is rounded and clamped to 0–10
 *  - the Hot/Warm/Cold label always follows the score thresholds, even if the
 *    model returned a different label
 */
export function normalizeScore(ai: ScoreAi): ScoreResult {
  const score = Math.round(clamp(ai.score, 0, 100));
  const factors = {} as ScoreFactors;
  for (const { key } of SCORE_FACTORS) {
    const f = ai.factors[key];
    factors[key] = { score: Math.round(clamp(f.score, 0, 10)), reason: f.reason.trim() };
  }
  return {
    score,
    label: labelForScore(score),
    explanation: ai.explanation.trim(),
    factors,
    positive_indicators: cleanList(ai.positive_indicators, 6),
    risk_factors: cleanList(ai.risk_factors, 6),
    next_action: ai.next_action.trim(),
    data_completeness: ai.data_completeness,
  };
}

/**
 * How much information a lead record contains, used to tell the model (and
 * the user) how reliable an estimate can be. Returns 0–1.
 */
export function leadCompleteness(lead: Record<string, unknown>): number {
  const fields = ['email', 'job_title', 'website', 'industry', 'company_size', 'budget', 'requirements', 'notes', 'location'];
  const filled = fields.filter((f) => {
    const v = lead[f];
    return typeof v === 'string' ? v.trim().length > 0 : v !== null && v !== undefined;
  }).length;
  return filled / fields.length;
}
