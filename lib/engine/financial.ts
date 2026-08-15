// Deterministic financial math. In the n8n workflow GPT-4 was asked to compute
// profit, margin, break-even, ratios and capital — arithmetic an LLM should
// never own. Here it's exact, testable code. The LLM keeps only *judgment*
// (revenue certainty, qualitative concerns) via FinancialJudgment.
//
// Scoring rubric is preserved verbatim from the "Financial Feasibility
// Specialist" prompt.

import type { BusinessInput, FinancialCalculations } from "./types";

export function computeFinancials(input: BusinessInput): FinancialCalculations {
  const monthly_revenue = Number(input.monthly_revenue) || 0;
  const monthly_cost = Number(input.monthly_cost) || 0;
  const monthly_profit = monthly_revenue - monthly_cost;

  const profit_margin_percent =
    monthly_revenue > 0 ? round1((monthly_profit / monthly_revenue) * 100) : 0;
  const annual_revenue = monthly_revenue * 12;
  const annual_profit = monthly_profit * 12;
  const revenue_to_cost_ratio = monthly_cost > 0 ? round2(monthly_revenue / monthly_cost) : 0;

  // Startup costs assumed 3× monthly cost when not otherwise specified.
  const startupCosts = monthly_cost * 3;
  const break_even_months =
    monthly_profit > 0 ? Math.ceil(startupCosts / monthly_profit) : null;

  const startup_capital_needed = monthly_cost * 6; // 6-month runway
  const working_capital_needed = monthly_cost * 3;

  const cash_flow_status: FinancialCalculations["cash_flow_status"] =
    monthly_profit > 0 ? "Positive" : monthly_profit < 0 ? "Negative" : "Break-even";

  const financial_feasibility_score = scoreFinancials({
    monthly_profit,
    profit_margin_percent,
    revenue_to_cost_ratio,
    break_even_months,
  });

  return {
    monthly_revenue,
    monthly_cost,
    monthly_profit,
    profit_margin_percent,
    annual_revenue,
    annual_profit,
    break_even_months,
    revenue_to_cost_ratio,
    startup_capital_needed,
    working_capital_needed,
    cash_flow_status,
    financial_feasibility_score,
  };
}

function scoreFinancials(m: {
  monthly_profit: number;
  profit_margin_percent: number;
  revenue_to_cost_ratio: number;
  break_even_months: number | null;
}): number {
  // Profitability (40)
  let profitability: number;
  if (m.monthly_profit > 5000) profitability = 40;
  else if (m.monthly_profit >= 1000) profitability = 30;
  else if (m.monthly_profit >= 0) profitability = 20;
  else profitability = 0;

  // Profit margin (30)
  let margin: number;
  if (m.profit_margin_percent >= 30) margin = 30;
  else if (m.profit_margin_percent >= 20) margin = 25;
  else if (m.profit_margin_percent >= 10) margin = 15;
  else margin = 5;

  // Revenue-to-cost ratio (20)
  let ratio: number;
  if (m.revenue_to_cost_ratio >= 2) ratio = 20;
  else if (m.revenue_to_cost_ratio >= 1.5) ratio = 15;
  else if (m.revenue_to_cost_ratio >= 1.2) ratio = 10;
  else ratio = 0;

  // Break-even timeline (10). Never-breaks-even → worst bucket.
  let breakeven: number;
  if (m.break_even_months === null) breakeven = 3;
  else if (m.break_even_months < 12) breakeven = 10;
  else if (m.break_even_months <= 24) breakeven = 7;
  else breakeven = 3;

  return profitability + margin + ratio + breakeven;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
