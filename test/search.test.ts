import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSearchProvider,
  gatherResearch,
  NO_RESEARCH_NOTICE,
  SerpApiProvider,
  SerperProvider,
  type SearchProvider,
} from "@/lib/engine/search";
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

const SEARCH_ENV = ["SEARCH_PROVIDER", "SERPER_API_KEY", "SERPAPI_API_KEY", "FEASIBILITY_MOCK"] as const;

async function withSearchEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T> | T): Promise<T> {
  const before = Object.fromEntries(SEARCH_ENV.map((k) => [k, process.env[k]]));
  for (const k of SEARCH_ENV) delete process.env[k];
  for (const [k, v] of Object.entries(vars)) if (v !== undefined) process.env[k] = v;
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const SERPER_KEY = "serper-test-key-do-not-log";

test("SerperProvider: maps organic[] to title/snippet/url and keeps the top 5", async () => {
  const realFetch = globalThis.fetch;
  const organic = Array.from({ length: 7 }, (_, i) => ({
    title: `Title ${i}`,
    snippet: `Snippet ${i}`,
    link: `https://example.test/${i}`,
    position: i + 1,
  }));
  let seen: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    seen = { url, init: init ?? {} };
    return new Response(JSON.stringify({ organic }), { status: 200 });
  }) as typeof fetch;
  try {
    const p = new SerperProvider({ mock: false, apiKey: SERPER_KEY });
    const hits = await p.search("specialty coffee", 5);
    assert.equal(seen?.url, "https://google.serper.dev/search");
    assert.equal(seen?.init.method, "POST");
    const headers = new Headers(seen?.init.headers);
    assert.equal(headers.get("X-API-KEY"), SERPER_KEY);
    assert.equal(headers.get("content-type"), "application/json");
    assert.deepEqual(JSON.parse(String(seen?.init.body)), { q: "specialty coffee" });
    assert.equal(String(seen?.init.body).includes("num"), false);
    assert.equal(seen?.url.includes(SERPER_KEY), false);
    assert.ok(seen?.init.signal);
    assert.deepEqual(
      hits,
      [0, 1, 2, 3, 4].map((i) => ({ title: `Title ${i}`, snippet: `Snippet ${i}`, url: `https://example.test/${i}` }))
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("SerperProvider: non-2xx fails, empty organic is empty, and the key is never logged", async () => {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const logged: string[] = [];
  console.error = ((...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  }) as typeof console.error;
  const reply = (body: unknown, status = 200) =>
    (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as typeof fetch;
  try {
    const p = new SerperProvider({ mock: false, apiKey: SERPER_KEY });

    globalThis.fetch = reply({ organic: [{ title: "secret", snippet: "s", link: "https://x.test" }], error: "nope" }, 401);
    await assert.rejects(p.search("q"), /Serper 401/);

    globalThis.fetch = reply(`quota exceeded ${SERPER_KEY}`, 429);
    await assert.rejects(p.search("q"), (err: Error) => {
      assert.match(err.message, /Serper 429/);
      assert.equal(err.message.includes(SERPER_KEY), false);
      assert.match(err.message, /\[redacted\]/);
      return true;
    });

    globalThis.fetch = reply({ organic: [] });
    assert.deepEqual(await p.search("q"), []);

    globalThis.fetch = reply({});
    assert.deepEqual(await p.search("q"), []);

    globalThis.fetch = reply({ organic: "nope" });
    assert.deepEqual(await p.search("q"), []);

    assert.equal(logged.join("\n").includes(SERPER_KEY), false);
  } finally {
    console.error = realError;
    globalThis.fetch = realFetch;
  }
});

test("SerperProvider: a real run with no key fails before any request", async () => {
  const realFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  try {
    await withSearchEnv({ SERPER_API_KEY: SERPER_KEY }, async () => {
      const explicit = new SerperProvider({ mock: false, apiKey: "" });
      await assert.rejects(explicit.search("anything"), /SERPER_API_KEY is not set/);
    });
    await withSearchEnv({}, async () => {
      const fromEnv = new SerperProvider({ mock: false });
      await assert.rejects(fromEnv.search("anything"), /SERPER_API_KEY is not set/);
    });
    assert.equal(called, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("createSearchProvider: defaults to serpapi and does not follow whichever key exists", async () => {
  const realFetch = globalThis.fetch;
  let called = false;
  let url = "";
  globalThis.fetch = (async (input: string) => {
    called = true;
    url = input;
    return new Response(JSON.stringify({ organic_results: [] }), { status: 200 });
  }) as typeof fetch;
  try {
    await withSearchEnv({ SERPER_API_KEY: SERPER_KEY }, async () => {
      const p = createSearchProvider({ mock: false });
      assert.ok(p instanceof SerpApiProvider);
      assert.equal(p instanceof SerperProvider, false);
      await assert.rejects(p.search("q"), /SERPAPI_API_KEY is not set/);
      assert.equal(called, false);
    });

    await withSearchEnv({ SEARCH_PROVIDER: "serpapi", SERPER_API_KEY: SERPER_KEY, SERPAPI_API_KEY: "serp-test-key" }, async () => {
      const p = createSearchProvider({ mock: false });
      assert.ok(p instanceof SerpApiProvider);
      await p.search("q");
      assert.match(url, /^https:\/\/serpapi\.com\/search\?/);
      assert.equal(url.includes("google.serper.dev"), false);
      assert.equal(url.includes(SERPER_KEY), false);
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("createSearchProvider: SEARCH_PROVIDER=serper uses Serper, including case and surrounding space", async () => {
  const realFetch = globalThis.fetch;
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init: init ?? {} });
    return new Response(JSON.stringify({ organic: [{ title: "T", snippet: "S", link: "https://serper.test" }] }), { status: 200 });
  }) as typeof fetch;
  try {
    for (const name of ["serper", "Serper", " serper "]) {
      const before = calls.length;
      await withSearchEnv({ SEARCH_PROVIDER: name, SERPER_API_KEY: SERPER_KEY, SERPAPI_API_KEY: "serp-test-key" }, async () => {
        const p = createSearchProvider({ mock: false });
        assert.ok(p instanceof SerperProvider);
        assert.deepEqual(await p.search("q"), [{ title: "T", snippet: "S", url: "https://serper.test" }]);
      });
      const seen = calls[before];
      assert.ok(seen);
      assert.equal(seen.url, "https://google.serper.dev/search");
      assert.equal(new Headers(seen.init.headers).get("X-API-KEY"), SERPER_KEY);
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("createSearchProvider: an unknown value fails closed without crashing or calling the network", async () => {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  const logged: string[] = [];
  console.error = ((...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  }) as typeof console.error;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  try {
    await withSearchEnv({ SEARCH_PROVIDER: "brave", SERPER_API_KEY: SERPER_KEY, SERPAPI_API_KEY: "serp-test-key" }, async () => {
      const p = createSearchProvider({ mock: false });
      assert.equal(p.mock, false);
      assert.equal(p instanceof SerpApiProvider, false);
      assert.equal(p instanceof SerperProvider, false);
      await assert.rejects(p.search("q"), /Unknown SEARCH_PROVIDER "brave"/);
      const research = await gatherResearch(p, "market", input);
      assert.equal(research.text, NO_RESEARCH_NOTICE);
      assert.equal(research.failed, research.queries);
      assert.match(research.errors[0], /Live web research is disabled/);
    });
    assert.equal(called, false);
    const line = logged.join("\n");
    assert.match(line, /Unknown SEARCH_PROVIDER "brave"/);
    assert.equal(line.includes(SERPER_KEY), false);
    assert.equal(line.includes("serp-test-key"), false);
  } finally {
    console.error = realError;
    globalThis.fetch = realFetch;
  }
});

test("createSearchProvider: FEASIBILITY_MOCK overrides both providers", async () => {
  const realFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  try {
    await withSearchEnv({ FEASIBILITY_MOCK: "true", SEARCH_PROVIDER: "serper", SERPER_API_KEY: SERPER_KEY }, async () => {
      const p = createSearchProvider({ mock: false });
      assert.ok(p instanceof SerperProvider);
      assert.equal(p.mock, true);
      const hits = await p.search("coffee");
      assert.match(hits[0].title, /\[mock\]/);
      assert.match(hits[0].snippet, /SERPER_API_KEY/);
    });
    await withSearchEnv({ FEASIBILITY_MOCK: "true", SERPAPI_API_KEY: "serp-test-key" }, async () => {
      const p = createSearchProvider({ mock: false });
      assert.ok(p instanceof SerpApiProvider);
      assert.equal(p.mock, true);
      const hits = await p.search("coffee");
      assert.match(hits[0].snippet, /SERPAPI_API_KEY/);
    });
    assert.equal(called, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});
