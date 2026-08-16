// Self-contained HTML renderer for a feasibility report — no React, no deps, no
// external assets. Produces a print-ready A4 document from a FullResult. Used by
// the CLI PDF script now, and it's the exact module the Firebase-phase Puppeteer
// worker will call server-side to generate stored/emailed PDFs.

import type { FullResult } from "@/lib/engine/runFeasibility";
import type { StageName } from "@/lib/engine/types";

const ORDER: StageName[] = ["market", "financial", "technical", "competitive", "location", "risk"];
const DIM_LABEL: Record<StageName, string> = {
  market: "Market",
  financial: "Financial",
  technical: "Technical",
  competitive: "Competitive",
  location: "Location & Legal",
  risk: "Risk",
};

const C = {
  paper: "#F8F6F1",
  surface: "#FFFFFF",
  surface2: "#F1EEE7",
  border: "#E4DFD4",
  ink: "#1A1814",
  muted: "#5C5648",
  faint: "#8E8779",
  brand: "#264DF0",
  go: "#0E9464",
  warn: "#C26C08",
  stop: "#CA2C2C",
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function money(n: number, cur = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString()}`;
  }
}
const tone = (s: number) => (s >= 70 ? C.go : s >= 45 ? C.warn : C.stop);
const verdictColor = (rec: string) =>
  rec.startsWith("GO (with") || rec.startsWith("CONDITIONAL") ? C.warn : rec.startsWith("GO") ? C.go : C.stop;

function bar(score: number) {
  return `<div style="height:7px;background:${C.border};border-radius:99px;overflow:hidden">
    <div style="height:100%;width:${Math.max(3, score)}%;background:${tone(score)};border-radius:99px"></div></div>`;
}

function list(items: string[], color: string, numbered = false) {
  return `<ul style="margin:0;padding:0;list-style:none">${items
    .map(
      (it, i) =>
        `<li style="display:flex;gap:8px;margin:5px 0;font-size:12.5px;color:${C.muted}">
        <span style="color:${color};font-weight:700;font-family:monospace">${numbered ? i + 1 : "·"}</span>
        <span>${esc(it)}</span></li>`
    )
    .join("")}</ul>`;
}

export function renderReportHtml(result: FullResult, opts: { date?: string } = {}): string {
  const { input, overall, categoryScores: cs, financials: f, riskScoring, report } = result;
  const cur = input.currency ?? "USD";
  const date = opts.date ?? "";
  const vc = verdictColor(overall.recommendation);

  const scorecard = ORDER.map(
    (s) => `<div style="border:1px solid ${C.border};border-radius:12px;padding:12px 14px;background:${C.surface2}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">
        <span style="font-size:12.5px;font-weight:600">${DIM_LABEL[s]}</span>
        <span style="font-family:monospace;font-weight:700;font-size:16px;color:${tone(cs[s])}">${cs[s]}</span>
      </div>${bar(cs[s])}</div>`
  ).join("");

  const finRows = [
    ["Monthly revenue", money(f.monthly_revenue, cur), C.ink],
    ["Monthly cost", money(f.monthly_cost, cur), C.ink],
    ["Monthly profit", money(f.monthly_profit, cur), f.monthly_profit >= 0 ? C.go : C.stop],
    ["Profit margin", `${f.profit_margin_percent}%`, C.ink],
    ["Revenue / cost ratio", String(f.revenue_to_cost_ratio), C.ink],
    ["Break-even", f.break_even_months === null ? "Never" : `${f.break_even_months} months`, C.ink],
    ["Startup capital needed", money(f.startup_capital_needed, cur), C.ink],
    ["Cash flow", f.cash_flow_status, f.cash_flow_status === "Positive" ? C.go : f.cash_flow_status === "Negative" ? C.stop : C.warn],
  ]
    .map(
      ([k, v, col]) =>
        `<tr><td style="padding:7px 0;color:${C.muted};border-bottom:1px solid ${C.border};font-size:12.5px">${k}</td>
        <td style="padding:7px 0;text-align:right;font-family:monospace;font-weight:600;color:${col};border-bottom:1px solid ${C.border};font-size:12.5px">${esc(v)}</td></tr>`
    )
    .join("");

  const risks = riskScoring.rankedRisks
    .slice(0, 6)
    .map(
      (r) => `<div style="border:1px solid ${C.border};border-radius:10px;padding:10px 12px;background:${C.surface2};margin:6px 0;break-inside:avoid">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div><span style="display:inline-block;font-size:10px;font-weight:700;color:${C.muted};background:${C.surface};border:1px solid ${C.border};border-radius:99px;padding:1px 8px;margin-bottom:4px">${esc(r.category)}</span>
        <div style="font-size:12.5px;font-weight:600">${esc(r.description)}</div></div>
        <div style="text-align:right"><div style="font-family:monospace;font-weight:700;color:${tone(100 - (r.priority ?? 0))}">${r.priority}</div>
        <div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:${C.faint}">priority</div></div>
      </div>
      <div style="font-size:11px;color:${C.muted};margin-top:5px">Impact ${r.impact}% · Likelihood ${r.probability}% · Mitigation: ${esc(r.mitigation)}</div>
    </div>`
    )
    .join("");

  const narratives = ORDER.map(
    (s) => `<div style="margin:9px 0;break-inside:avoid">
      <div style="display:flex;justify-content:space-between;font-weight:600;font-size:12.5px">
        <span>${DIM_LABEL[s]}</span><span style="font-family:monospace;color:${tone(cs[s])}">${cs[s]}/100</span></div>
      <p style="margin:3px 0 0;font-size:12px;color:${C.muted};line-height:1.5">${esc(report.dimension_narratives[s])}</p></div>`
  ).join("");

  const metric = (label: string, value: string, color = C.ink) =>
    `<div style="background:${C.surface};border:1px solid ${C.border};border-radius:10px;padding:9px 11px">
      <div style="font-family:monospace;font-weight:700;font-size:15px;color:${color}">${esc(value)}</div>
      <div style="font-size:9.5px;color:${C.faint};margin-top:1px">${label}</div></div>`;

  const sources = result.sources.length
    ? `<div class="card"><h2>Sources</h2>${result.sources
        .slice(0, 10)
        .map((s) => `<div style="font-size:11.5px;color:${C.brand};margin:3px 0;word-break:break-all">${esc(s.title || s.url)}</div>`)
        .join("")}</div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 14mm 13mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color:${C.ink}; background:${C.surface}; margin:0; font-size:13px; line-height:1.5; }
    h1,h2,h3 { font-family: Georgia, "Times New Roman", serif; letter-spacing:-.01em; margin:0; }
    .card { border:1px solid ${C.border}; border-radius:14px; padding:16px 18px; margin:0 0 14px; break-inside:avoid; }
    .card > h2 { font-size:15px; margin-bottom:11px; }
    .head { display:flex; justify-content:space-between; align-items:center; padding-bottom:12px; border-bottom:1px solid ${C.border}; margin-bottom:16px; }
    .label { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:${C.faint}; font-weight:700; }
    .badge { display:inline-block; border-radius:99px; padding:3px 11px; font-size:11px; font-weight:700; }
  </style></head><body>

  <div class="head">
    <div style="display:flex;align-items:center;gap:9px">
      <div style="width:26px;height:26px;border-radius:7px;background:${C.brand};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-family:Georgia,serif">F</div>
      <strong style="font-size:15px">Feasibility<span style="color:${C.brand};font-family:Georgia,serif;font-style:italic">AI</span></strong>
    </div>
    <div style="text-align:right;font-size:10px;color:${C.faint}">Feasibility Report${date ? `<br>${esc(date)}` : ""}</div>
  </div>

  <!-- Verdict hero -->
  <div class="card" style="background:${C.paper};display:flex;gap:20px;align-items:center">
    <div style="text-align:center;min-width:120px">
      <div style="font-family:monospace;font-weight:700;font-size:46px;line-height:1;color:${tone(overall.overall_score)}">${overall.overall_score}</div>
      <div class="label" style="margin-top:4px">/ 100</div>
      <div style="font-size:11px;color:${C.muted};margin-top:2px">${esc(overall.rating)}</div>
    </div>
    <div style="flex:1">
      <span class="badge" style="background:${vc}1f;color:${vc};border:1px solid ${vc}55">${esc(overall.recommendation)}</span>
      <h1 style="font-size:20px;margin:8px 0 3px">${esc(input.business_idea)}</h1>
      <div style="font-size:11.5px;color:${C.muted}">${esc(input.target_customer)} · ${esc(input.location)}</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px">
        ${metric("Monthly profit", money(f.monthly_profit, cur), f.monthly_profit >= 0 ? C.go : C.stop)}
        ${metric("Margin", `${f.profit_margin_percent}%`)}
        ${metric("Break-even", f.break_even_months === null ? "—" : `${f.break_even_months} mo`)}
        ${metric("Startup capital", money(f.startup_capital_needed, cur))}
      </div>
    </div>
  </div>

  <div class="card"><h2>Scorecard</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px">${scorecard}</div></div>

  <div class="card"><h2>Executive summary</h2>
    <p style="margin:0;color:${C.muted};font-size:12.5px">${esc(report.executive_summary)}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px">
      <div><div class="label" style="margin-bottom:5px">Key findings</div>${list(report.key_findings, C.brand)}</div>
      <div><div class="label" style="margin-bottom:5px">Critical success factors</div>${list(report.critical_success_factors, C.go)}</div>
    </div></div>

  <div class="card"><h2>Financial analysis</h2>
    <table style="width:100%;border-collapse:collapse">${finRows}</table></div>

  <div class="card"><h2>Risk register <span style="font-weight:400;font-size:11px;color:${C.muted}">— overall ${riskScoring.overallRiskScore}/100 · ${esc(riskScoring.riskLevel)}</span></h2>
    ${risks}</div>

  <div class="card"><h2>Detailed analysis</h2>${narratives}</div>

  <div class="card"><h2>Recommendation &amp; next steps</h2>
    <p style="margin:0 0 10px;color:${C.muted};font-size:12.5px">${esc(report.conclusion)}</p>
    ${result.conditions.length ? `<div class="label" style="margin-bottom:4px">Conditions to address first</div>${list(result.conditions, C.warn)}` : ""}
    <div class="label" style="margin:10px 0 4px">Next steps</div>${list(result.nextSteps, C.brand, true)}</div>

  ${sources}

  <div style="text-align:center;font-size:10px;color:${C.faint};margin-top:6px">
    Generated by FeasibilityAI${result.usage.mock ? " · demo data" : ""} · Decision aid, not a guarantee.
  </div>
  </body></html>`;
}
