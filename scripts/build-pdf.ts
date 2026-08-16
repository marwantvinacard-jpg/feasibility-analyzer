// Generate a real PDF from a feasibility run, with no npm/Chromium install:
// run the engine → render self-contained HTML → drive the system Chrome in
// headless mode with --print-to-pdf. Prototypes the Firebase-phase server PDF.
//
//   npm run pdf                    # mock run, sample input
//   npm run pdf -- fixtures/x.json

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { runFeasibility, type BusinessInput } from "../lib/engine";
import { renderReportHtml } from "../lib/report/renderHtml";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function main() {
  if (process.env.FEASIBILITY_MOCK === undefined && !process.env.OPENAI_API_KEY) {
    process.env.FEASIBILITY_MOCK = "true";
  }
  const inputPath = resolve(process.argv[2] ?? "fixtures/sample-input.json");
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as BusinessInput;

  console.log(`\n▶ Running engine (${process.env.FEASIBILITY_MOCK === "true" ? "MOCK" : "LIVE"}) …`);
  const result = await runFeasibility(input);

  mkdirSync("scratch", { recursive: true });
  const htmlPath = resolve("scratch/report.html");
  const pdfPath = resolve("scratch/feasibility-report.pdf");
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(htmlPath, renderReportHtml(result, { date }));
  console.log(`  HTML → ${htmlPath}`);

  console.log("  Rendering PDF via headless Chrome …");
  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-pdf-header-footer",
      `--print-to-pdf=${pdfPath}`,
      "--no-margins",
      `file://${htmlPath}`,
    ],
    { stdio: "ignore" }
  );
  console.log(`\n✓ PDF written to ${pdfPath}`);
  console.log(`  Verdict: ${result.overall.overall_score}/100 — ${result.overall.recommendation}\n`);
}

main().catch((e) => {
  console.error("PDF build failed:", e);
  process.exit(1);
});
