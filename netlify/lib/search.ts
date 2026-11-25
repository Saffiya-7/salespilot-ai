// Optional live web search for AI Lead Research.
// Configure with LIVE_SEARCH_PROVIDER = "gemini" (Grounding with Google Search,
// uses GEMINI_API_KEY; may be billed separately by Google) or "tavily"
// (needs TAVILY_API_KEY). With no provider, research uses only the user's input
// and the UI says so.
import { GoogleGenAI } from '@google/genai';
import type { ResearchSource } from '../../shared/types';
import { env } from './http';
import { geminiModel } from './gemini';

export type SearchProvider = 'none' | 'gemini' | 'tavily';

export function searchProvider(): { provider: SearchProvider; configured: boolean } {
  const p = (env('LIVE_SEARCH_PROVIDER') ?? 'none').toLowerCase();
  if (p === 'tavily') return { provider: 'tavily', configured: Boolean(env('TAVILY_API_KEY')) };
  if (p === 'gemini' || p === 'google') return { provider: 'gemini', configured: Boolean(env('GEMINI_API_KEY')) };
  return { provider: 'none', configured: false };
}

export interface SearchFindings {
  /** Numbered snippets the research prompt may cite. */
  results: { title: string; url: string; content: string }[];
  provider: SearchProvider;
}

function isPublicHttpUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

async function tavilySearch(query: string): Promise<SearchFindings> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env('TAVILY_API_KEY')}` },
      body: JSON.stringify({ query, max_results: 6, search_depth: 'basic', include_answer: false }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Search provider returned ${res.status}`);
    const json = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    const results = (json.results ?? [])
      .filter((r) => r.url && isPublicHttpUrl(r.url))
      .slice(0, 6)
      .map((r) => ({ title: (r.title ?? r.url ?? '').slice(0, 200), url: r.url as string, content: (r.content ?? '').slice(0, 1200) }));
    return { results, provider: 'tavily' };
  } finally {
    clearTimeout(timer);
  }
}

async function geminiGroundedSearch(query: string): Promise<SearchFindings> {
  const ai = new GoogleGenAI({ apiKey: env('GEMINI_API_KEY') as string });
  const res = await ai.models.generateContent({
    model: geminiModel(),
    contents: `Search the web and report concise, factual, current public information about: ${query}.
Cover: what the company does, products/services, customers/market, approximate size, location, and any recent news.
Only report facts found in the search results. If nothing reliable is found, say so.`,
    config: { tools: [{ googleSearch: {} }], temperature: 0.1, httpOptions: { timeout: 25_000 } },
  });
  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const text = (res.text ?? '').slice(0, 5000);
  const sources = chunks
    .map((c) => c.web)
    .filter((w): w is { uri: string; title?: string } => Boolean(w?.uri && isPublicHttpUrl(w.uri)))
    .slice(0, 8);
  // Gemini returns one synthesized text plus the pages it was grounded on; we attach
  // that text to the first source and list the rest so citations stay real URLs.
  const results = sources.map((s, i) => ({ title: (s.title ?? s.uri).slice(0, 200), url: s.uri, content: i === 0 ? text : '' }));
  if (results.length === 0 && text) return { results: [], provider: 'gemini' };
  return { results, provider: 'gemini' };
}

export async function liveSearch(query: string): Promise<SearchFindings | null> {
  const { provider, configured } = searchProvider();
  if (provider === 'none' || !configured) return null;
  try {
    return provider === 'tavily' ? await tavilySearch(query) : await geminiGroundedSearch(query);
  } catch (e) {
    console.warn('[live-search] failed, falling back to input-only research', (e as Error).message);
    return null;
  }
}

export function toSources(f: SearchFindings | null): ResearchSource[] {
  return (f?.results ?? []).map((r) => ({ title: r.title, url: r.url }));
}
