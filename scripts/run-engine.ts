// CLI harness for the engine — proves the whole pipeline end to end with no
// UI and no Firebase. Runs in MOCK mode by default (zero keys, zero cost) so
// the orchestration + deterministic math can be verified in isolation.
//
//   npm run engine                       # mock, sample input
//   npm run engine -- fixtures/x.json    # mock, custom input
//   FEASIBILITY_MOCK=false npm run engine # live (needs OPENAI_API_KEY)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { runFeasibility, type BusinessInput } from "../lib/engine";

// Default to mock unless the caller explicitly opts into live mode.
if (process.env.FEASIBILITY_MOCK === undefined && !process.env.OPENAI_API_KEY) {
  process.env.FEASIBILITY_MOCK = "true";
}

async function main() {
  const inputPath = resolve(process.argv[2] ?? "fixtures/sample-input.json");
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as BusinessInput;

  const mock = process.env.FEASIBILITY_MOCK === "true";
  console.log(`\n▶ Running feasibility engine (${mock ? "MOCK" : "LIVE"}) on: ${inputPath}\n`);

  const progress: string[] = [];
  const result = await runFeasibility(input, {
    onProgress: (stage, status) => {
      if (status === "done" || status === "failed") {
        progress.push(`${status === "done" ? "✓" : "✗"} ${stage}`);
        process.stdout.write(`  ${status === "done" ? "✓" : "✗"} ${stage}\n`);
      }
    },
  });

  const s = result.categoryScores;
  const o = result.overall;
  const f = result.financials;

  console.log("\n" + "=".repeat(56));
  console.log(`  ${o.emoji}  ${o.overall_score}/100 — ${o.rating}`);
  console.log(`  Recommendation: ${o.recommendation}`);
  console.log("=".repeat(56));
  console.log("\n  Category scores");
  console.log(`    Market       ${bar(s.market)} ${s.market}`);
  console.log(`    Financial    ${bar(s.financial)} ${s.financial}`);
  console.log(`    Technical    ${bar(s.technical)} ${s.technical}`);
  console.log(`    Competitive  ${bar(s.competitive)} ${s.competitive}`);
  console.log(`    Location     ${bar(s.location)} ${s.location}`);
  console.log(`    Risk (safe)  ${bar(s.risk)} ${s.risk}`);

  console.log("\n  Financials (computed in code)");
  console.log(`    Monthly profit   ${f.monthly_profit}  (${f.profit_margin_percent}% margin)`);
  console.log(`    Rev/cost ratio   ${f.revenue_to_cost_ratio}`);
  console.log(
    `    Break-even       ${f.break_even_months === null ? "never (non-positive profit)" : f.break_even_months + " months"}`
  );
  console.log(`    Startup capital  ${f.startup_capital_needed}`);
  console.log(`    Financial score  ${f.financial_feasibility_score}/100`);

  console.log("\n  Risk");
  console.log(`    Level ${result.riskScoring.riskLevel}, overall ${result.riskScoring.overallRiskScore}/100`);
  console.log(`    Top risk: ${result.riskScoring.rankedRisks[0]?.description ?? "n/a"}`);

  console.log("\n  Strengths:      " + result.strengths.join("; "));
  console.log("  Critical issues:" + result.criticalIssues.join("; "));
  if (result.conditions.length) console.log("  Conditions:     " + result.conditions.join("; "));

  console.log("\n  Report (executive summary)");
  console.log("    " + result.report.executive_summary.replace(/\n/g, "\n    "));

  console.log(
    `\n  Usage: ${result.usage.mock ? "MOCK (no cost)" : `${result.usage.tokensIn}→${result.usage.tokensOut} tok, ~${(result.usage.costCents / 100).toFixed(2)} USD`} · model ${result.usage.model}`
  );

  mkdirSync("scratch", { recursive: true });
  const out = resolve("scratch/last-result.json");
  writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(`\n  Full result written to ${out}\n`);
}

function bar(n: number, width = 20): string {
  const filled = Math.round((n / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

main().catch((err) => {
  console.error("\n✗ Engine run failed:\n", err);
  process.exit(1);
});
