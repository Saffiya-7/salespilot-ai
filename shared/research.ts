// Guards that keep "verified information" honest.
// - Without a live search provider, nothing can be marked as found on the web.
// - With one, a web statement is only kept as verified if its URL is one of
//   the sources the search provider actually returned. Anything else is moved
//   to the AI hypotheses list, clearly marked as unverified.
import { cleanList } from './scoring';
import type { ResearchAi } from './schemas';
import type { ResearchResult, ResearchSource, VerifiedStatement } from './types';

export function normalizeUrl(u: string): string {
  try {
    const url = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`);
    url.hash = '';
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    const path = url.pathname.replace(/\/+$/, '');
    return `${host}${path}${url.search}`;
  } catch {
    return u.trim().toLowerCase();
  }
}

export function sanitizeResearch(
  ai: ResearchAi,
  opts: { mode: 'input_only' | 'live_search'; sources: ResearchSource[]; model: string; now?: Date },
): ResearchResult {
  const allowed = new Map(opts.sources.map((s) => [normalizeUrl(s.url), s.url]));
  const verified: VerifiedStatement[] = [];
  const demoted: string[] = [];

  for (const item of ai.verified_information) {
    if (item.basis === 'user_input') {
      verified.push({ statement: item.statement, basis: 'user_input', source_url: null });
      continue;
    }
    // basis === 'web'
    const url = item.source_url ? allowed.get(normalizeUrl(item.source_url)) : undefined;
    if (opts.mode === 'live_search' && url) {
      verified.push({ statement: item.statement, basis: 'web', source_url: url });
    } else {
      demoted.push(`Unverified: ${item.statement}`);
    }
  }

  return {
    mode: opts.mode,
    company_overview: ai.company_overview,
    industry_classification: ai.industry_classification,
    likely_challenges: cleanList(ai.likely_challenges, 6),
    customer_needs: cleanList(ai.customer_needs, 6),
    product_use_cases: cleanList(ai.product_use_cases, 6),
    value_proposition: ai.value_proposition,
    sales_approach: ai.sales_approach,
    outreach_angle: ai.outreach_angle,
    verified_information: verified.slice(0, 15),
    ai_hypotheses: cleanList([...ai.ai_hypotheses, ...demoted], 10),
    information_gaps: cleanList(ai.information_gaps, 6),
    sources: opts.mode === 'live_search' ? opts.sources : [],
    generated_at: (opts.now ?? new Date()).toISOString(),
    model: opts.model,
  };
}
