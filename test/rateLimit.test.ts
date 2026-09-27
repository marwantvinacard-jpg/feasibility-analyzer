import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit } from "@/lib/rateLimit";
import { capBusinessInput } from "@/lib/engine/types";
import type { BusinessInput } from "@/lib/engine/types";

test("checkRateLimit: allows up to the limit, then blocks within the window", async () => {
  const key = `test-${Date.now()}-${Math.random()}`;
  for (let i = 0; i < 3; i++) {
    const r = await checkRateLimit(key, 3, 60_000);
    assert.equal(r.allowed, true, `request ${i + 1} of 3 should be allowed`);
  }
  const blocked = await checkRateLimit(key, 3, 60_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
});

test("checkRateLimit: a fresh key always gets a clean window", async () => {
  const r = await checkRateLimit(`fresh-${Date.now()}-${Math.random()}`, 1, 60_000);
  assert.equal(r.allowed, true);
  assert.equal(r.remaining, 0);
});

test("checkRateLimit: different keys never share a bucket", async () => {
  const base = `iso-${Date.now()}-${Math.random()}`;
  await checkRateLimit(`${base}-a`, 1, 60_000);
  const other = await checkRateLimit(`${base}-b`, 1, 60_000);
  assert.equal(other.allowed, true, "a different key must not be affected by another key's usage");
});

function minimalInput(overrides: Partial<BusinessInput> = {}): BusinessInput {
  return {
    business_idea: "x",
    target_customer: "x",
    location: "x",
    problem_solved: "x",
    product_service: "x",
    revenue_model: "x",
    competitors: "x",
    monthly_cost: 1000,
    monthly_revenue: 2000,
    unique_advantage: "x",
    currency: "USD",
    ...overrides,
  } as BusinessInput;
}

test("capBusinessInput: truncates an over-length text field instead of sending it whole to the LLM", () => {
  const huge = "a".repeat(10_000);
  const capped = capBusinessInput(minimalInput({ business_idea: huge }));
  assert.ok(capped.business_idea.length < huge.length, "should be truncated");
  assert.ok(capped.business_idea.endsWith("[truncated]"));
});

test("capBusinessInput: leaves short, well-formed input untouched", () => {
  const input = minimalInput({ business_idea: "A normal, short business idea." });
  const capped = capBusinessInput(input);
  assert.equal(capped.business_idea, input.business_idea);
});

test("capBusinessInput: caps the knowledge base separately and more generously than short text fields", () => {
  const bigKnowledge = "b".repeat(30_000);
  const capped = capBusinessInput(minimalInput({ knowledge_base: bigKnowledge } as Partial<BusinessInput>));
  assert.ok((capped as any).knowledge_base.length < bigKnowledge.length);
  assert.ok((capped as any).knowledge_base.length > 15_000, "knowledge base cap should be much larger than a text field's");
});
