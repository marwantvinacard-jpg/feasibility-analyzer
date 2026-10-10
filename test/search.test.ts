import { test } from "node:test";
import assert from "node:assert/strict";
import { gatherResearch, NO_RESEARCH_NOTICE, SerpApiProvider, type SearchProvider } from "@/lib/engine/search";
import { runFeasibility } from "@/lib/engine/runFeasibility";
import { createLlm } from "@/lib/engine/factory";
import { ALL_STAGES, type BusinessInput } from "@/lib/engine/types";

const input: BusinessInput = {
  business_idea: "Specialty coffee kiosk",
  target_customer: "Office workers",
  location: "Tunis, Tunisia",
  problem_solved: "No good coffee near the business district",
  product_service: "Espresso drinks and pastries",
  revenue_model: "Per-cup sales",
  competitors: "Local cafes",
  monthly_cost: 4000,
  monthly_revenue: 7000,
  unique_advantage: "Fastest service in the district",
};

const failing: SearchProvider = {
  mock: false,
  search: async () => {
    throw new Error("SerpAPI: Your account has run out of searches.");
  },
};

test("gatherResearch: every search failing gives the no-research notice, never throws", async () => {
  const r = await gatherResearch(failing, "market", input);
  assert.equal(r.text, NO_RESEARCH_NOTICE);
  assert.equal(r.queries, 2);
  assert.equal(r.failed, 2);
  assert.deepEqual(r.sources, []);
  assert.match(r.errors[0], /run out of searches/);
});

test("gatherResearch: one failed query keeps the results of the others", async () => {
  let n = 0;
  const flaky: SearchProvider = {
    mock: false,
    search: async (q) => {
      if (n++ === 0) throw new Error("timeout");
      return [{ title: "Real hit", snippet: "data", url: `https://example.org/${encodeURIComponent(q)}` }];
    },
  };
  const r = await gatherResearch(flaky, "market", input);
  assert.equal(r.failed, 1);
  assert.equal(r.sources.length, 1);
  assert.match(r.text, /WEB RESEARCH CONTEXT/);
  assert.doesNotMatch(r.text, /UNAVAILABLE/);
});

test("gatherResearch: stages with no queries add nothing to the prompt", async () => {
  const r = await gatherResearch(failing, "stakeholders", input);
  assert.deepEqual(r, { text: "", sources: [], queries: 0, failed: 0, errors: [] });
});

test("SerpApiProvider: a real (non-mock) run with no key fails instead of returning mock snippets", async () => {
  const p = new SerpApiProvider({ mock: false, apiKey: "" });
  await assert.rejects(p.search("anything"), /SERPAPI_API_KEY is not set/);
});

test("SerpApiProvider: 200 + error body is a failure, except 'no results' which is just empty", async () => {
  const realFetch = globalThis.fetch;
  const reply = (body: unknown, status = 200) =>
    (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
  try {
    const p = new SerpApiProvider({ mock: false, apiKey: "test-key" });

    globalThis.fetch = reply({ error: "Your account has run out of searches." });
    await assert.rejects(p.search("q"), /run out of searches/);

    globalThis.fetch = reply({ error: "Google hasn't returned any results for this query." });
    assert.deepEqual(await p.search("q"), []);

    globalThis.fetch = reply({ error: "boom" }, 500);
    await assert.rejects(p.search("q"), /SerpAPI 500/);

    globalThis.fetch = reply({ organic_results: [{ title: "T", snippet: "S", link: "https://x.test" }] });
    assert.deepEqual(await p.search("q"), [{ title: "T", snippet: "S", url: "https://x.test" }]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("runFeasibility: a total search outage no longer fails the specialists or fakes their scores", async () => {
  const result = await runFeasibility(input, { llm: createLlm({ provider: "mock" }), search: failing });

  // Before the fix every research stage failed and was scored a neutral 50.
  for (const stage of ALL_STAGES) assert.equal(result.stageStatus[stage], "done", `${stage} should still run`);

  assert.ok(result.research);
  assert.equal(result.research.failed, result.research.queries);
  assert.deepEqual(
    [...result.research.stagesWithoutResearch].sort(),
    ["competitive", "financial_model", "legal", "location", "market", "operational", "risk", "technical"]
  );
  assert.match(result.research.sampleError ?? "", /run out of searches/);
  assert.deepEqual(result.sources, []);
});

test("runFeasibility: healthy search reports no missing research", async () => {
  const llm = createLlm({ provider: "mock" });
  const result = await runFeasibility(input, { llm, search: new SerpApiProvider({ mock: true }) });
  assert.equal(result.research?.failed, 0);
  assert.deepEqual(result.research?.stagesWithoutResearch, []);
});
