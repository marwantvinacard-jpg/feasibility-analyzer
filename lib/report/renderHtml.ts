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

  ${renderStudy(result)}

  <div style="text-align:center;font-size:10px;color:${C.faint};margin-top:6px">
    Generated by FeasibilityAI${result.usage.mock ? " · demo data" : ""} · Decision aid, not a guarantee.
  </div>
  </body></html>`;
}

// --- Financial feasibility study (the 15-section outline) --------------------

/** Numbered section heading, page-break aware. */
function sec(n: number, title: string, body: string, subtitle = ""): string {
  return `<div class="card"><h2>
    <span style="display:inline-block;min-width:20px;color:${C.brand}">${n}.</span> ${title}
    ${subtitle ? `<span style="font-weight:400;font-size:10.5px;color:${C.muted}"> — ${subtitle}</span>` : ""}
  </h2>${body}</div>`;
}

const signedPct = (n: number) => `${n > 0 ? "+" : ""}${n}%`;

function p(text: string): string {
  return `<p style="margin:0 0 8px;color:${C.muted};font-size:12px;line-height:1.55">${esc(text)}</p>`;
}

function table(head: string[], rows: string[][], rightFrom = 1): string {
  const th = head
    .map(
      (h, i) =>
        `<th style="text-align:${i >= rightFrom ? "right" : "left"};padding:5px 6px;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:${C.faint};border-bottom:1px solid ${C.border};white-space:nowrap">${esc(h)}</th>`
    )
    .join("");
  const tr = rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (cell, i) =>
              `<td style="text-align:${i >= rightFrom ? "right" : "left"};padding:5px 6px;font-size:11px;border-bottom:1px solid ${C.border};${
                i >= rightFrom ? "font-family:monospace;" : ""
              }">${cell}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:4px 0">${th ? `<thead><tr>${th}</tr></thead>` : ""}<tbody>${tr}</tbody></table>`;
}

function renderStudy(result: FullResult): string {
  const study = result.study;
  if (!study) return "";
  const { model, projections: pr, narrative: n } = study;
  const cur = pr.currency;
  const f = (v: number) => esc(money(v, cur));
  const yrs = pr.annual;
  const vc = n.verdict === "Viable" ? C.go : n.verdict === "Viable with conditions" ? C.warn : C.stop;

  const metric = (label: string, value: string, color = C.ink) =>
    `<div style="background:${C.surface2};border:1px solid ${C.border};border-radius:10px;padding:8px 10px">
      <div style="font-family:monospace;font-weight:700;font-size:13.5px;color:${color}">${value}</div>
      <div style="font-size:9px;color:${C.faint};margin-top:1px">${esc(label)}</div></div>`;

  const grid = (cells: string) =>
    `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:8px 0">${cells}</div>`;

  return `
  <div style="break-before:page;padding-top:4px">
    <h1 style="font-size:19px;margin:0 0 2px">Financial Feasibility Study</h1>
    <div style="font-size:11px;color:${C.muted};margin-bottom:14px">
      ${pr.projectionYears}-year projection · all figures in ${esc(cur)}
    </div>
  </div>

  ${sec(
    1,
    "Executive Summary",
    `<span class="badge" style="background:${vc}1f;color:${vc};border:1px solid ${vc}55;margin-bottom:8px">${esc(n.verdict)}</span>
     ${p(n.executive_summary)}
     <div style="border:1px solid ${C.brand}44;background:${C.brand}0d;border-radius:10px;padding:9px 11px;margin:8px 0">
       <div class="label" style="color:${C.brand};margin-bottom:3px">Investment ask</div>
       <div style="font-size:11.5px;color:${C.ink}">${esc(n.investment_ask)}</div></div>
     ${grid(
       metric("Total capital required", f(pr.funding.total)) +
         metric(
           "Payback",
           pr.returns.paybackMonths === null ? "Beyond horizon" : `${pr.returns.paybackMonths} mo`,
           pr.returns.paybackMonths === null ? C.stop : C.go
         ) +
         metric(
           `IRR (${pr.projectionYears}y)`,
           pr.returns.irrPercent === null ? "n/a" : `${pr.returns.irrPercent}%`,
           pr.returns.irrPercent !== null && pr.returns.irrPercent >= pr.returns.discountRatePercent ? C.go : C.warn
         ) +
         metric(`NPV @ ${pr.returns.discountRatePercent}%`, f(pr.returns.npv), pr.returns.npv >= 0 ? C.go : C.stop)
     )}`
  )}

  ${sec(2, "Project Overview & Scope", p(n.project_overview))}

  ${sec(
    3,
    "Market Analysis",
    p(n.market_basis) +
      (model.pricing_benchmarks.length
        ? table(
            ["Reference", "Price point", "Note"],
            model.pricing_benchmarks.map((b) => [esc(b.reference), esc(b.price_point), esc(b.note)]),
            99
          )
        : ""),
    "Evidence behind the revenue assumptions"
  )}

  ${sec(
    4,
    "Capital Expenditure",
    table(
      ["Category", `Amount`, "Share"],
      [
        ...pr.capexByCategory.map((c) => [
          esc(c.category),
          f(c.amount),
          `${pr.capexTotal > 0 ? Math.round((c.amount / pr.capexTotal) * 100) : 0}%`,
        ]),
        [`<strong>Total</strong>`, `<strong>${f(pr.capexTotal)}</strong>`, `<strong>100%</strong>`],
      ]
    ) + p(n.capex_commentary),
    `${money(pr.capexTotal, cur)} one-time setup cost`
  )}

  ${sec(
    5,
    "Operating Expenditure",
    table(
      ["Category", "Monthly", "Annual"],
      [
        ...pr.opexByCategory.map((o) => [esc(o.category), f(o.monthly), f(o.annual)]),
        [
          `<strong>Total</strong>`,
          `<strong>${f(pr.opexMonthlyTotal)}</strong>`,
          `<strong>${f(pr.opexMonthlyTotal * 12)}</strong>`,
        ],
      ]
    ) + p(n.opex_commentary),
    `${money(pr.opexMonthlyTotal, cur)}/month at maturity`
  )}

  ${sec(
    6,
    "Revenue Projections",
    table(
      ["Stream", "Volume/mo", "Price", "Util.", "COGS", "Ramp"],
      model.revenue_streams.map((s) => [
        `${esc(s.name)}<div style="font-size:9.5px;color:${C.faint}">${esc(s.unit_label)}</div>`,
        Math.round(s.units_per_month).toLocaleString(),
        f(s.price_per_unit),
        `${s.utilization_percent}%`,
        `${s.cogs_percent}%`,
        `${s.ramp_months} mo`,
      ])
    ) +
      table(
        ["", ...yrs.map((y) => `Year ${y.year}`)],
        [["Revenue", ...yrs.map((y) => f(y.revenue))]]
      ) +
      p(n.revenue_commentary),
    "Volume and price stated explicitly"
  )}

  ${sec(
    7,
    "Assumptions & Basis of Estimates",
    (pr.reconciliation
      ? `<div style="border:1px solid ${pr.reconciliation.materiallyDifferent ? C.warn + "55" : C.border};background:${
          pr.reconciliation.materiallyDifferent ? C.warn + "0d" : C.surface2
        };border-radius:10px;padding:9px 11px;margin-bottom:9px">
          <div class="label" style="margin-bottom:3px;${pr.reconciliation.materiallyDifferent ? `color:${C.warn}` : ""}">Reconciliation with the stated figures</div>
          ${table(
            ["", "Stated", "This model", "Variance"],
            [
              [
                "Monthly revenue at maturity",
                f(pr.reconciliation.statedMonthlyRevenue),
                f(pr.reconciliation.modelledMonthlyRevenue),
                signedPct(pr.reconciliation.revenueVariancePercent),
              ],
              [
                "Monthly cost at maturity",
                f(pr.reconciliation.statedMonthlyCost),
                f(pr.reconciliation.modelledMonthlyCost),
                signedPct(pr.reconciliation.costVariancePercent),
              ],
            ]
          )}
          ${
            pr.reconciliation.materiallyDifferent
              ? `<div style="font-size:10px;color:${C.muted};margin-top:4px">This study models the economics it judges realistic for the location and business type rather than repeating the figures supplied. Where it differs from the scorecard, this is the reason.</div>`
              : ""
          }
        </div>`
      : "") +
    table(
      ["Area", "Assumption", "Value", "Basis", "Conf."],
      model.assumption_notes.map((a) => [
        esc(a.area),
        esc(a.assumption),
        esc(a.value),
        esc(a.basis),
        esc(a.confidence),
      ]),
      99
    ) +
      p(n.assumptions_commentary) +
      (model.exclusions.length
        ? `<div class="label" style="margin:8px 0 3px">Explicitly excluded</div>${list(model.exclusions, C.faint)}`
        : "")
  )}

  ${sec(
    8,
    "Profit & Loss Projection",
    table(
      ["", ...yrs.map((y) => `Year ${y.year}`)],
      [
        ["<strong>Revenue</strong>", ...yrs.map((y) => `<strong>${f(y.revenue)}</strong>`)],
        ["Cost of goods sold", ...yrs.map((y) => `(${f(y.cogs)})`)],
        ["<strong>Gross profit</strong>", ...yrs.map((y) => `<strong>${f(y.grossProfit)}</strong>`)],
        ["Gross margin", ...yrs.map((y) => `${y.grossMarginPercent}%`)],
        ["Operating expenses", ...yrs.map((y) => `(${f(y.opex)})`)],
        [
          "<strong>EBITDA</strong>",
          ...yrs.map(
            (y) => `<strong style="color:${y.ebitda >= 0 ? C.go : C.stop}">${f(y.ebitda)}</strong>`
          ),
        ],
        ["EBITDA margin", ...yrs.map((y) => `${y.ebitdaMarginPercent}%`)],
        ["Depreciation", ...yrs.map((y) => `(${f(y.depreciation)})`)],
        ["Interest", ...yrs.map((y) => `(${f(y.interest)})`)],
        ["Tax", ...yrs.map((y) => `(${f(y.tax)})`)],
        [
          "<strong>Net profit</strong>",
          ...yrs.map(
            (y) => `<strong style="color:${y.netProfit >= 0 ? C.go : C.stop}">${f(y.netProfit)}</strong>`
          ),
        ],
      ]
    ) + p(n.pl_commentary),
    `Consolidated across ${pr.projectionYears} years`
  )}

  ${sec(
    9,
    "Cash Flow Projection",
    table(
      ["Month", "Revenue", "EBITDA", "Tax", "Debt svc", "Net cash", "Balance"],
      pr.monthly
        .slice(0, 12)
        .map((m) => [
          esc(m.label),
          f(m.revenue),
          `<span style="color:${m.ebitda >= 0 ? C.go : C.stop}">${f(m.ebitda)}</span>`,
          f(m.tax),
          f(m.debtService),
          f(m.netCashFlow),
          `<span style="color:${m.cashBalance >= 0 ? C.ink : C.stop};font-weight:700">${f(m.cashBalance)}</span>`,
        ])
    ) +
      grid(
        metric(
          "Lowest cash balance",
          f(pr.funding.minimumCashBalance),
          pr.funding.minimumCashBalance >= 0 ? C.go : C.stop
        ) +
          metric("Peak operating deficit", f(pr.funding.peakOperatingDeficit)) +
          metric(
            "Funding gap",
            pr.funding.fundingGap > 0 ? f(pr.funding.fundingGap) : "None",
            pr.funding.fundingGap > 0 ? C.stop : C.go
          )
      ) +
      p(n.cashflow_commentary),
    "Monthly through year one"
  )}

  ${sec(
    10,
    "Break-Even Analysis",
    grid(
      metric(
        "Operating break-even",
        pr.breakEven.operatingMonth === null ? "Never" : `Month ${pr.breakEven.operatingMonth}`,
        pr.breakEven.operatingMonth === null ? C.stop : C.go
      ) +
        metric(
          "Investment payback",
          pr.breakEven.paybackMonth === null ? "Beyond horizon" : `Month ${pr.breakEven.paybackMonth}`,
          pr.breakEven.paybackMonth === null ? C.stop : C.go
        ) +
        metric("Break-even revenue", `${f(pr.breakEven.monthlyRevenue)}/mo`) +
        metric(
          `Break-even ${pr.breakEven.unitLabel}`,
          pr.breakEven.unitsPerMonth === null
            ? "n/a"
            : Math.ceil(pr.breakEven.unitsPerMonth).toLocaleString()
        )
    ) +
      table(
        ["Variable", "Change", "Y1 EBITDA", "Payback", "NPV"],
        pr.sensitivity.map((s) => [
          esc(s.variable),
          s.change,
          f(s.year1Ebitda),
          s.paybackMonth === null ? "—" : `${s.paybackMonth} mo`,
          f(s.npv),
        ]),
        2
      ) +
      p(n.breakeven_commentary)
  )}

  ${sec(
    11,
    "Funding Requirement & Structure",
    grid(
      metric("Capital expenditure", f(pr.funding.totalCapex)) +
        metric("Working capital", f(pr.funding.total - pr.funding.totalCapex)) +
        metric("Total requirement", f(pr.funding.total), C.brand)
    ) +
      table(
        ["Source", "Amount", "Share"],
        [
          ["Equity", f(pr.funding.equity), `${model.funding.equity_percent}%`],
          ["Debt", f(pr.funding.debt), `${model.funding.debt_percent}%`],
          ["Owner capital", f(pr.funding.ownerCapital), `${model.funding.owner_capital_percent}%`],
        ]
      ) +
      table(
        ["Use of funds", "Amount"],
        pr.funding.useOfFunds.map((u) => [esc(u.purpose), f(u.amount)])
      ) +
      p(n.funding_commentary)
  )}

  ${sec(
    12,
    "Return Metrics",
    grid(
      metric(
        `Cumulative ${pr.projectionYears}-year ROI`,
        `${pr.returns.roiPercent}%`,
        pr.returns.roiPercent >= 0 ? C.go : C.stop
      ) +
        metric(
          "Payback period",
          pr.returns.paybackMonths === null ? "Beyond horizon" : `${pr.returns.paybackMonths} months`
        ) +
        metric("IRR", pr.returns.irrPercent === null ? "Not meaningful" : `${pr.returns.irrPercent}%`) +
        metric(`NPV @ ${pr.returns.discountRatePercent}%`, f(pr.returns.npv), pr.returns.npv >= 0 ? C.go : C.stop)
    ) +
      table(
        ["Free cash flow", ...pr.returns.cashFlows.map((_, i) => (i === 0 ? "Year 0" : `Year ${i}`))],
        [[`In ${esc(cur)}`, ...pr.returns.cashFlows.map((c) => f(c))]]
      ) +
      p(n.returns_commentary),
    `Project-level, excluding terminal value`
  )}

  ${sec(
    13,
    "Risk Assessment",
    table(
      ["Category", "Risk", "Mitigation"],
      n.financial_risks.map((r) => [esc(r.category), esc(r.risk), esc(r.mitigation)]),
      99
    ) + p(n.risk_commentary)
  )}

  ${sec(
    14,
    "Sensitivity Analysis",
    table(
      ["Scenario", "Y1 revenue", "Y1 EBITDA", "Payback", "ROI", "IRR", "NPV"],
      pr.scenarios.map((s) => [
        `<strong style="color:${
          s.name === "Best case" ? C.go : s.name === "Worst case" ? C.stop : C.ink
        }">${esc(s.name)}</strong><div style="font-size:9px;color:${C.faint}">${esc(s.description)}</div>`,
        f(s.year1Revenue),
        f(s.year1Ebitda),
        s.paybackMonth === null ? "—" : `${s.paybackMonth} mo`,
        `${s.roiPercent}%`,
        s.irrPercent === null ? "—" : `${s.irrPercent}%`,
        f(s.npv),
      ])
    ) + p(n.sensitivity_commentary),
    "Best / base / worst case"
  )}

  ${sec(
    15,
    "Conclusion & Recommendation",
    `<span class="badge" style="background:${vc}1f;color:${vc};border:1px solid ${vc}55;margin-bottom:8px">${esc(n.verdict)}</span>
     ${p(n.conclusion)}
     ${
       n.conditions.length
         ? `<div class="label" style="margin:8px 0 3px">Conditions attached to a go decision</div>${list(n.conditions, C.warn, true)}`
         : ""
     }`
  )}`;
}
