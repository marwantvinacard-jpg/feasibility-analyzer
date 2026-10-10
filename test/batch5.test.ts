import { test } from "node:test";
import assert from "node:assert/strict";
import { createLlm, LlmConfigError } from "@/lib/engine/factory";
import { OpenAIProvider } from "@/lib/engine/provider";
import { buildProjections, normalizeFundingMix } from "@/lib/engine/projections";
import { mockFinancialModel } from "@/lib/engine/mocks";
import { ORG_PLANS, orgTrialCredits } from "@/lib/pricing";
import { z } from "zod";
import type { BusinessInput } from "@/lib/engine/types";

const PROVIDER_ENV = ["FEASIBILITY_PROVIDER", "FEASIBILITY_MOCK", "OPENAI_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "CEREBRAS_API_KEY", "OLLAMA_HOST", "VERCEL_ENV"];

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const before = Object.fromEntries(PROVIDER_ENV.map((k) => [k, process.env[k]]));
  for (const k of PROVIDER_ENV) delete process.env[k];
  for (const [k, v] of Object.entries(vars)) if (v !== undefined) process.env[k] = v;
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// ---------- #8 ----------
test("#8: production with no AI key refuses to fall back to mock reports", () => {
  withEnv({ VERCEL_ENV: "production" }, () => assert.throws(() => createLlm(), LlmConfigError));
});

test("#8: production with FEASIBILITY_MOCK / FEASIBILITY_PROVIDER=mock also refuses", () => {
  withEnv({ VERCEL_ENV: "production", FEASIBILITY_MOCK: "true" }, () => assert.throws(() => createLlm(), LlmConfigError));
  withEnv({ VERCEL_ENV: "production", FEASIBILITY_PROVIDER: "mock" }, () => assert.throws(() => createLlm(), LlmConfigError));
});

test("#8: code that explicitly asks for mock (tests, the static sample report) still gets it", () => {
  withEnv({ VERCEL_ENV: "production" }, () => assert.equal(createLlm({ provider: "mock" }).mock, true));
});

test("#8: a real key + a stray FEASIBILITY_MOCK=true no longer silently becomes mock", () => {
  withEnv({ OPENAI_API_KEY: "sk-test-0123456789", FEASIBILITY_PROVIDER: "openai", FEASIBILITY_MOCK: "true" }, () =>
    assert.equal(createLlm().mock, false)
  );
});

test("#8: local development without keys keeps working in mock mode", () => {
  withEnv({}, () => assert.equal(createLlm().mock, true));
});

// ---------- #27 ----------
async function captureRequest(opts: { baseURL?: string }) {
  let sent: Record<string, unknown> = {};
  const p = new OpenAIProvider({ apiKey: "sk-test-0123456789", mock: false, ...opts });
  (p as unknown as { client: unknown }).client = {
    chat: {
      completions: {
        create: async (args: Record<string, unknown>) => {
          sent = args;
          return { choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } };
        },
      },
    },
  };
  await p.structured({ system: "s", user: "u", schema: z.object({ ok: z.boolean() }), schemaName: "t", mockValue: { ok: true } });
  return sent;
}

test("#27: AI calls use a low temperature (was the default 1.0) and a fixed seed on OpenAI", async () => {
  const sent = await captureRequest({});
  assert.equal(sent.temperature, 0.2);
  assert.equal(typeof sent.seed, "number");
  const again = await captureRequest({});
  assert.equal(again.seed, sent.seed); // same seed every run
});

test("#27: other providers get the low temperature but no `seed` (not all support it)", async () => {
  const sent = await captureRequest({ baseURL: "https://api.groq.com/openai/v1" });
  assert.equal(sent.temperature, 0.2);
  assert.equal("seed" in sent, false);
});

// ---------- #31 ----------
test("#31: funding percentages are scaled to exactly 100%, keeping proportions", () => {
  const base = { debt_interest_percent: 8, debt_term_years: 5, structure_rationale: "" };
  assert.deepEqual(normalizeFundingMix({ ...base, equity_percent: 60, debt_percent: 60, owner_capital_percent: 0 }), { equity: 50, debt: 50, owner: 0 });
  assert.deepEqual(normalizeFundingMix({ ...base, equity_percent: 30, debt_percent: 30, owner_capital_percent: 40 }), { equity: 30, debt: 30, owner: 40 });
  assert.deepEqual(normalizeFundingMix({ ...base, equity_percent: 0, debt_percent: 0, owner_capital_percent: 0 }), { equity: 0, debt: 0, owner: 100 });
});

test("#31: a 60/60/0 split now funds 100% of the requirement, not 120%", () => {
  const input = { business_idea: "Cafe", monthly_cost: 4000, monthly_revenue: 7000, currency: "USD" } as BusinessInput;
  const model = mockFinancialModel(input);
  model.funding = { ...model.funding, equity_percent: 60, debt_percent: 60, owner_capital_percent: 0 };
  const f = buildProjections(model).funding;
  assert.ok(Math.abs(f.equity + f.debt + f.ownerCapital - f.total) < 0.01, `sum ${f.equity + f.debt + f.ownerCapital} vs total ${f.total}`);
  assert.ok(Math.abs(f.debt - f.total / 2) < 0.01, "debt should be half");

  const balanced = mockFinancialModel(input);
  balanced.funding = { ...balanced.funding, equity_percent: 50, debt_percent: 50, owner_capital_percent: 0 };
  // Same interest/debt service as a correctly stated 50/50 split.
  assert.equal(buildProjections(model).annual[0].interest, buildProjections(balanced).annual[0].interest);
});

// ---------- #21 ----------
test("#21: an org trial grants 10% of the plan's monthly credits, not the full month", () => {
  assert.deepEqual(ORG_PLANS.map((p) => [p.key, p.creditsPerMonth, orgTrialCredits(p)]), [
    ["starter", 50, 5],
    ["growth", 150, 15],
    ["enterprise", 500, 50],
  ]);
});
