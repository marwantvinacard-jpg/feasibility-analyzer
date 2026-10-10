import { test } from "node:test";
import assert from "node:assert/strict";
import { Semaphore, isRateLimited, retryIfRateLimited, withConcurrencyLimit } from "@/lib/engine/concurrency";
import { OpenAIProvider, type LlmProvider, type StructuredCall } from "@/lib/engine/provider";
import { runFeasibility } from "@/lib/engine/runFeasibility";
import { createLlm } from "@/lib/engine/factory";
import { SerpApiProvider } from "@/lib/engine/search";
import type { BusinessInput } from "@/lib/engine/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rateLimitError = () => Object.assign(new Error("429 Rate limit reached"), { status: 429 });

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

test("Semaphore: never runs more than `capacity` tasks at once, and runs them all", async () => {
  const sem = new Semaphore(3);
  let running = 0;
  let peak = 0;
  const done: number[] = [];
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      sem.run(async () => {
        running++;
        peak = Math.max(peak, running);
        await sleep(2 + (i % 4));
        running--;
        done.push(i);
      })
    )
  );
  assert.equal(peak, 3);
  assert.equal(done.length, 20);
  assert.equal(sem.inUse, 0);
  assert.equal(sem.waiting, 0);
});

test("Semaphore: waiters get slots in arrival order, and a failing task still frees its slot", async () => {
  const sem = new Semaphore(1);
  const order: number[] = [];
  const first = sem.run(async () => {
    await sleep(5);
    throw new Error("boom");
  });
  const rest = [1, 2, 3].map((n) => sem.run(async () => void order.push(n)));
  await assert.rejects(first, /boom/);
  await Promise.all(rest);
  assert.deepEqual(order, [1, 2, 3]);
  assert.equal(sem.inUse, 0);
});

test("withConcurrencyLimit: a burst of model calls is capped per limiter", async () => {
  let running = 0;
  let peak = 0;
  const slow: LlmProvider = {
    mock: false,
    model: "test",
    async structured<T>(call: StructuredCall<T>) {
      running++;
      peak = Math.max(peak, running);
      await sleep(3);
      running--;
      return { data: call.mockValue, tokensIn: 0, tokensOut: 0 };
    },
  };
  const limited = withConcurrencyLimit(slow, new Semaphore(4));
  assert.equal(limited.model, "test");
  await Promise.all(
    Array.from({ length: 12 }, () => limited.structured({ system: "", user: "", schema: {} as never, schemaName: "x", mockValue: 1 }))
  );
  assert.equal(peak, 4);
});

test("isRateLimited: recognises 429s only", () => {
  assert.equal(isRateLimited(rateLimitError()), true);
  assert.equal(isRateLimited({ code: "rate_limit_exceeded" }), true);
  assert.equal(isRateLimited(Object.assign(new Error("bad request"), { status: 400 })), false);
  assert.equal(isRateLimited(new Error("schema mismatch")), false);
  assert.equal(isRateLimited(null), false);
});

test("retryIfRateLimited: one extra try after a 429; other errors are not retried", async () => {
  let calls = 0;
  const value = await retryIfRateLimited(async () => {
    if (calls++ === 0) throw rateLimitError();
    return "ok";
  }, () => 1);
  assert.equal(value, "ok");
  assert.equal(calls, 2);

  let badCalls = 0;
  await assert.rejects(
    retryIfRateLimited(async () => {
      badCalls++;
      throw new Error("schema mismatch");
    }, () => 1),
    /schema mismatch/
  );
  assert.equal(badCalls, 1);
});

test("OpenAIProvider: real clients get a bounded timeout and more retries than the SDK default", () => {
  const p = new OpenAIProvider({ apiKey: "test-key" }) as unknown as { client: { timeout: number; maxRetries: number } };
  assert.equal(p.client.timeout, 60_000); // SDK default is 10 minutes
  assert.equal(p.client.maxRetries, 3); // SDK default is 2
});

/** Mock-backed provider whose chosen calls fail the way a busy provider does. */
function flakyLlm(failFor: (schemaName: string, attempt: number) => boolean): LlmProvider {
  const base = createLlm({ provider: "mock" });
  const attempts = new Map<string, number>();
  return {
    mock: false,
    model: "test",
    async structured<T>(call: StructuredCall<T>) {
      const n = (attempts.get(call.schemaName) ?? 0) + 1;
      attempts.set(call.schemaName, n);
      if (failFor(call.schemaName, n)) throw rateLimitError();
      return base.structured(call);
    },
  };
}

test("runFeasibility: sections rate-limited once recover on retry — nothing is silently scored 50", async () => {
  const llm = flakyLlm((_name, attempt) => attempt === 1); // EVERY call is turned away once
  const result = await runFeasibility(input, { llm, search: new SerpApiProvider({ mock: true }) });
  assert.deepEqual(result.failedStages, []);
  for (const [stage, status] of Object.entries(result.stageStatus)) assert.equal(status, "done", stage);
});

test("runFeasibility: a section that keeps failing is recorded, not hidden", async () => {
  const llm = flakyLlm((name) => name === "market"); // market never gets through
  const result = await runFeasibility(input, { llm, search: new SerpApiProvider({ mock: true }) });
  assert.equal(result.stageStatus.market, "failed");
  assert.deepEqual(result.failedStages?.map((f) => f.stage), ["market"]);
  assert.match(result.failedStages![0].error, /429/);
  assert.equal(result.categoryScores.market, 50); // the placeholder the report now calls out
});
