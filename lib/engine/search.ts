// Web search. In n8n each research specialist had a SerpAPI tool wired in as
// an ai_tool. Here we pre-fetch a small, capped set of stage-specific queries
// and inject the snippets into that specialist's prompt as research context —
// deterministic, cost-bounded, and easy to cache. Swappable provider so
// SerpAPI can later be replaced by Brave/Tavily/Exa without touching callers.
//
// SECURITY: the SerpAPI key that was hard-coded in the n8n JSON must be rotated
// and supplied via SERPAPI_API_KEY. Never commit it.

import type { BusinessInput, Source, StageName } from "./types";
import { fence } from "./untrusted";

export interface SearchHit {
  title: string;
  snippet: string;
  url: string;
}

/** Per-query cap, well inside the route's maxDuration. */
const SEARCH_TIMEOUT_MS = 10_000;

export interface SearchProvider {
  readonly mock: boolean;
  search(query: string, num?: number): Promise<SearchHit[]>;
}

export class SerpApiProvider implements SearchProvider {
  readonly mock: boolean;
  private apiKey?: string;

  constructor(opts: { apiKey?: string; mock?: boolean } = {}) {
    this.mock = opts.mock ?? process.env.FEASIBILITY_MOCK === "true";
    this.apiKey = opts.apiKey ?? process.env.SERPAPI_API_KEY;
  }

  async search(query: string, num = 5): Promise<SearchHit[]> {
    if (this.mock) {
      // Deterministic placeholder so the pipeline runs with zero keys/cost.
      return [
        {
          title: `[mock] Result for "${query}"`,
          snippet: `Mock research snippet for "${query}". Enable a real SERPAPI_API_KEY to fetch live data.`,
          url: `https://example.com/search?q=${encodeURIComponent(query)}`,
        },
      ];
    }
    // A real run with no key must NOT fall back to mock snippets — those would
    // be cited as sources in a paid report. Fail, and let gatherResearch mark
    // the stage as "no live research".
    if (!this.apiKey) throw new Error("SERPAPI_API_KEY is not set");
    const params = new URLSearchParams({ q: query, api_key: this.apiKey, num: String(num) });
    const res = await fetch(`https://serpapi.com/search?${params.toString()}`, {
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { organic_results?: any[]; error?: string };
    // SerpAPI answers 200 + { error } both for "no results" (fine — just empty)
    // and for real failures like an exhausted quota (not fine).
    if (json.error && !json.organic_results) {
      if (/hasn't returned any results/i.test(json.error)) return [];
      throw new Error(`SerpAPI: ${json.error}`);
    }
    return (json.organic_results ?? []).slice(0, num).map((r) => ({
      title: r.title ?? "",
      snippet: r.snippet ?? "",
      url: r.link ?? "",
    }));
  }
}

/** Stages that fetch research. The financial model is not a scoring dimension. */
export type ResearchStage = StageName | "financial_model" | "stakeholders";

/** Stage-specific queries. Kept few + generic so results cache well. */
function queriesFor(stage: ResearchStage, input: BusinessInput): string[] {
  const idea = input.business_idea;
  const loc = input.location;
  switch (stage) {
    case "financial_model":
      return [
        `${idea} startup cost breakdown ${loc}`,
        `${idea} equipment fit-out cost ${loc}`,
        `commercial rent per sqm ${loc}`,
        `${input.product_service} average price ${loc}`,
      ];
    case "market":
      return [`${idea} market size ${loc}`, `${idea} industry trends ${new Date().getFullYear()}`];
    case "competitive":
      return [`${idea} competitors ${loc}`, `${input.competitors} pricing reviews`];
    case "location":
      return [`business license requirements ${loc}`, `${loc} economy cost of living business`];
    case "technical":
      return [`${input.product_service} how to build cost`];
    case "risk":
      return [`${idea} business risks challenges`];
    case "operational":
      return [`${idea} staffing requirements ${loc}`, `${input.product_service} supply chain suppliers ${loc}`];
    case "legal":
      return [`business license permits requirements ${loc}`, `${idea} regulatory compliance ${loc}`];
    default:
      return [];
  }
}

export interface ResearchContext {
  text: string; // formatted block injected into the specialist prompt
  sources: Source[];
  /** Queries attempted / failed for this stage — surfaced on the result so a
   *  search outage is visible instead of silently degrading the report. */
  queries: number;
  failed: number;
  errors: string[];
}

/** Told to the specialist when no live research came back, so it analyses from
 *  the business data instead of failing — and doesn't fabricate citations. */
export const NO_RESEARCH_NOTICE =
  "\n\n--- WEB RESEARCH: UNAVAILABLE ---\n" +
  "Live web research could not be retrieved for this section. Base the analysis on the business data " +
  "and general knowledge, say clearly where figures are estimates, and do NOT invent sources, URLs, " +
  "statistics or market figures. Leave any research_sources list empty.";

/**
 * Runs the capped queries for a stage and formats snippets + sources. Never
 * throws: each query succeeds or fails on its own, so one SerpAPI error (quota,
 * 5xx, timeout) no longer wipes out the whole specialist — the stage still runs,
 * just without live research, and the failure is counted.
 */
export async function gatherResearch(
  provider: SearchProvider,
  stage: ResearchStage,
  input: BusinessInput,
  maxQueries = Number(process.env.FEASIBILITY_MAX_SEARCHES_PER_STAGE ?? 4)
): Promise<ResearchContext> {
  const queries = queriesFor(stage, input).slice(0, maxQueries);
  if (queries.length === 0) return { text: "", sources: [], queries: 0, failed: 0, errors: [] };

  const settled = await Promise.allSettled(queries.map((q) => provider.search(q, 5)));

  const sources: Source[] = [];
  const blocks: string[] = [];
  const errors: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === "rejected") {
      errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
      return;
    }
    if (r.value.length === 0) return;
    blocks.push(
      `Query: ${queries[i]}\n` +
        r.value.map((h) => `- ${h.title}: ${h.snippet} (${h.url})`).join("\n")
    );
    for (const h of r.value) if (h.url) sources.push({ title: h.title, url: h.url });
  });

  return {
    text:
      blocks.length > 0
        ? `\n\n--- WEB RESEARCH CONTEXT (cite these where relevant) ---\n${fence("web search results", blocks.join("\n\n"))}`
        : NO_RESEARCH_NOTICE,
    sources,
    queries: queries.length,
    failed: errors.length,
    errors,
  };
}
