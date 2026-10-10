import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { ByokError, decryptSecret, encryptSecret, isByokProvider, validateKeyFormat } from "@/lib/byok";
import { fallbackReport, ReportSchema } from "@/lib/engine/report";
import { runFeasibility } from "@/lib/engine/runFeasibility";
import { createLlm } from "@/lib/engine/factory";
import { SerpApiProvider } from "@/lib/engine/search";
import type { LlmProvider, StructuredCall } from "@/lib/engine/provider";
import type { BusinessInput } from "@/lib/engine/types";
import { emailSender } from "@/lib/email";
import { runAfterResponse } from "@/lib/afterResponse";

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

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const before: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    before[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/** Mock-backed provider that fails chosen calls. */
function llmFailing(shouldFail: (schemaName: string, attempt: number) => boolean): LlmProvider {
  const base = createLlm({ provider: "mock" });
  const attempts = new Map<string, number>();
  return {
    mock: false,
    model: "test",
    async structured<T>(call: StructuredCall<T>) {
      const n = (attempts.get(call.schemaName) ?? 0) + 1;
      attempts.set(call.schemaName, n);
      if (shouldFail(call.schemaName, n)) throw new Error(`model returned invalid JSON for ${call.schemaName}`);
      return base.structured(call);
    },
  };
}
const search = new SerpApiProvider({ mock: true });

// ---------- #23 BYOK encryption ----------
const KEY = randomBytes(32).toString("base64");

test("BYOK: a key round-trips through encryption and is never stored in plain text", () => {
  withEnv({ BYOK_ENCRYPTION_KEY: KEY }, () => {
    const secret = encryptSecret("sk-live-abcdefghijklmnopqrstuvwxyz", "user-1");
    assert.doesNotMatch(JSON.stringify(secret), /abcdefghijklmnop/);
    assert.equal(decryptSecret(secret, "user-1"), "sk-live-abcdefghijklmnopqrstuvwxyz");
    // Same key twice → different ciphertext (random IV).
    assert.notEqual(encryptSecret("sk-live-abcdefghijklmnopqrstuvwxyz", "user-1").ct, secret.ct);
  });
});

test("BYOK: a stored key copied onto ANOTHER user's record won't decrypt", () => {
  withEnv({ BYOK_ENCRYPTION_KEY: KEY }, () => {
    const secret = encryptSecret("sk-live-abcdefghijklmnopqrstuvwxyz", "user-1");
    assert.throws(() => decryptSecret(secret, "user-2"));
  });
});

test("BYOK: tampered ciphertext, or a different server key, won't decrypt", () => {
  withEnv({ BYOK_ENCRYPTION_KEY: KEY }, () => {
    const secret = encryptSecret("sk-live-abcdefghijklmnopqrstuvwxyz", "user-1");
    const bytes = Buffer.from(secret.ct, "base64");
    bytes[0] ^= 1;
    assert.throws(() => decryptSecret({ ...secret, ct: bytes.toString("base64") }, "user-1"));
    withEnv({ BYOK_ENCRYPTION_KEY: randomBytes(32).toString("base64") }, () => {
      assert.throws(() => decryptSecret(secret, "user-1"));
    });
  });
});

test("BYOK: without a proper server encryption key, nothing is stored (503, not plain text)", () => {
  withEnv({ BYOK_ENCRYPTION_KEY: undefined }, () => {
    assert.throws(() => encryptSecret("sk-x", "u"), (e: unknown) => e instanceof ByokError && e.status === 503);
  });
  withEnv({ BYOK_ENCRYPTION_KEY: Buffer.from("too short").toString("base64") }, () => {
    assert.throws(() => encryptSecret("sk-x", "u"), (e: unknown) => e instanceof ByokError && e.status === 503);
  });
});

test("BYOK: key format and provider checks", () => {
  assert.equal(validateKeyFormat("  sk-proj-0123456789abcdefghij  "), "sk-proj-0123456789abcdefghij");
  assert.throws(() => validateKeyFormat("short"), ByokError);
  assert.throws(() => validateKeyFormat("sk-with a space-0123456789abcdef"), ByokError);
  assert.throws(() => validateKeyFormat(42), ByokError);
  assert.equal(isByokProvider("openai"), true);
  assert.equal(isByokProvider("ollama"), false); // a hosted server can't reach someone's local Ollama
  assert.equal(isByokProvider("mock"), false);
});

// ---------- #17 report writer failing ----------
test("#17: report writer fails once → retried, real report, no fallback", async () => {
  const result = await runFeasibility(input, { llm: llmFailing((n, a) => n === "report" && a === 1), search });
  assert.equal(result.reportFallback, undefined);
  assert.ok(!result.failedStages?.some((f) => f.stage === "report"));
});

test("#17: report writer fails twice → the run still completes with a score-based summary", async () => {
  const result = await runFeasibility(input, { llm: llmFailing((n) => n === "report"), search });
  assert.equal(result.reportFallback, true);
  assert.ok(result.failedStages?.some((f) => f.stage === "report" && /invalid JSON/.test(f.error)));
  ReportSchema.parse(result.report); // valid report content
  assert.match(result.report.executive_summary, new RegExp(`${result.overall.overall_score}/100`));
  assert.doesNotMatch(JSON.stringify(result.report), /\(mock\)/);
  // Everything else is intact: verdict, all sections, the study.
  for (const status of Object.values(result.stageStatus)) assert.equal(status, "done");
  assert.ok(result.study);
});

test("#17: fallback report uses only real numbers from the scores and financials", () => {
  const r = fallbackReport({
    input,
    overall: { overall_score: 64, rating: "FEASIBLE", recommendation: "GO (with conditions)", emoji: "" },
    scores: { market: 80, financial: 70, technical: 60, competitive: 50, location: 55, operational: 65, legal: 45, risk: 40 },
    riskScoring: { rankedRisks: [], overallRiskScore: 50, riskLevel: "Medium", riskFeasibilityScore: 50, assessed: false },
    financials: { monthly_profit: 3000, profit_margin_percent: 43 } as never,
    strengths: ["Strong market"],
    criticalIssues: [],
    conditions: ["Secure a lease"],
    nextSteps: ["Validate demand"],
  });
  ReportSchema.parse(r);
  assert.match(r.executive_summary, /64\/100/);
  assert.match(r.executive_summary, /market \(80\/100\)/); // strongest
  assert.match(r.executive_summary, /risk \(40\/100\)/); // weakest
  assert.match(r.major_risks[0], /could not be completed/);
});

// ---------- #18 failed risk section ----------
test("#18: a failed risk section is 'not assessed' and neutral 50 — not 100/100 'Low risk'", async () => {
  const result = await runFeasibility(input, { llm: llmFailing((n) => n === "risk"), search });
  assert.equal(result.riskScoring.assessed, false);
  assert.equal(result.categoryScores.risk, 50);
  assert.notEqual(result.riskScoring.riskLevel, "Low");
  assert.ok(result.failedStages?.some((f) => f.stage === "risk"));
});

test("#18: a risk call that returns an EMPTY register is also treated as failed", async () => {
  const base = createLlm({ provider: "mock" });
  const emptyRisk: LlmProvider = {
    mock: false,
    model: "test",
    structured<T>(call: StructuredCall<T>) {
      if (call.schemaName === "risk") return base.structured({ ...call, mockValue: { risks: [], dealbreaker_risks: [] } as T });
      return base.structured(call);
    },
  };
  const result = await runFeasibility(input, { llm: emptyRisk, search });
  assert.equal(result.stageStatus.risk, "done");
  assert.equal(result.categoryScores.risk, 50);
  assert.ok(result.failedStages?.some((f) => f.stage === "risk" && /empty risk register/.test(f.error)));
});

// ---------- #25 emails ----------
test("#25: production without EMAIL_FROM refuses Resend's test sender (it only reaches the account owner)", () => {
  withEnv({ EMAIL_FROM: undefined, VERCEL_ENV: "production" }, () => assert.equal(emailSender(), null));
  withEnv({ EMAIL_FROM: "FeasibilityAI <hello@example.com>", VERCEL_ENV: "production" }, () =>
    assert.equal(emailSender(), "FeasibilityAI <hello@example.com>")
  );
  withEnv({ EMAIL_FROM: undefined, VERCEL_ENV: "preview" }, () => assert.match(emailSender()!, /resend\.dev/));
});

test("#25: work handed to runAfterResponse still runs outside a Next.js request, and errors don't escape", async () => {
  let ran = false;
  runAfterResponse(async () => {
    ran = true;
  });
  runAfterResponse(async () => {
    throw new Error("send failed");
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(ran, true);
});
