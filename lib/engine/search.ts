// Web search. In n8n each research specialist had a SerpAPI tool wired in as
// an ai_tool. Here we pre-fetch a small, capped set of stage-specific queries
// and inject the snippets into that specialist's prompt as research context —
// deterministic, cost-bounded, and easy to cache. Swappable provider so
// SerpAPI can later be replaced by Brave/Tavily/Exa without touching callers.
//
// SECURITY: the SerpAPI key that was hard-coded in the n8n JSON must be rotated
// and supplied via SERPAPI_API_KEY. Never commit it.

import type { BusinessInput, Source, StageName } from "./types";

export interface SearchHit {
  title: string;
  snippet: string;
  url: string;
}

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
    if (this.mock || !this.apiKey) {
      // Deterministic placeholder so the pipeline runs with zero keys/cost.
      return [
        {
          title: `[mock] Result for "${query}"`,
          snippet: `Mock research snippet for "${query}". Enable a real SERPAPI_API_KEY to fetch live data.`,
          url: `https://example.com/search?q=${encodeURIComponent(query)}`,
        },
      ];
    }
    const params = new URLSearchParams({ q: query, api_key: this.apiKey, num: String(num) });
    const res = await fetch(`https://serpapi.com/search?${params.toString()}`);
    if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { organic_results?: any[] };
    return (json.organic_results ?? []).slice(0, num).map((r) => ({
      title: r.title ?? "",
      snippet: r.snippet ?? "",
      url: r.link ?? "",
    }));
  }
}

/** Stage-specific queries. Kept few + generic so results cache well. */
function queriesFor(stage: StageName, input: BusinessInput): string[] {
  const idea = input.business_idea;
  const loc = input.location;
  switch (stage) {
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
    default:
      return [];
  }
}

export interface ResearchContext {
  text: string; // formatted block injected into the specialist prompt
  sources: Source[];
}

/** Runs the capped queries for a stage and formats snippets + sources. */
export async function gatherResearch(
  provider: SearchProvider,
  stage: StageName,
  input: BusinessInput,
  maxQueries = Number(process.env.FEASIBILITY_MAX_SEARCHES_PER_STAGE ?? 4)
): Promise<ResearchContext> {
  const queries = queriesFor(stage, input).slice(0, maxQueries);
  if (queries.length === 0) return { text: "", sources: [] };

  const sources: Source[] = [];
  const blocks: string[] = [];
  for (const q of queries) {
    const hits = await provider.search(q, 5);
    blocks.push(
      `Query: ${q}\n` +
        hits.map((h) => `- ${h.title}: ${h.snippet} (${h.url})`).join("\n")
    );
    for (const h of hits) if (h.url) sources.push({ title: h.title, url: h.url });
  }
  return {
    text: `\n\n--- WEB RESEARCH CONTEXT (cite these where relevant) ---\n${blocks.join("\n\n")}`,
    sources,
  };
}
