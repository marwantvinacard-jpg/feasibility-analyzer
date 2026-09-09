// Deterministic financial projections built from a FinancialModel.
//
// Everything a decision-maker reads off the study — the P&L, the cash flow, the
// break-even, the funding requirement, ROI/payback/IRR/NPV and the scenario
// table — is computed here in plain arithmetic. The LLM supplies only the
// drivers (see financialModel.ts); it never produces a result figure.
//
// Modelling choices worth knowing, all surfaced in the study's basis notes:
//  • Volume and price are tracked separately, so a price change moves margin
//    while a volume change moves both revenue and COGS proportionally.
//  • Seasonality is normalised to a mean of 1.0 — it redistributes revenue
//    across the year, it does not inflate the annual total.
//  • Tax uses loss carry-forward, so early-year losses shelter later profits.
//  • IRR/NPV are project-level over the projection horizon with NO terminal or
//    exit value, which understates a going concern but invents nothing.

import { matureMonthlyRevenue, type FinancialModel } from "./financialModel";

/** Multipliers used to flex the model for scenario and sensitivity analysis. */
export interface Flex {
  price: number;
  volume: number;
  opex: number;
}

const BASE: Flex = { price: 1, volume: 1, opex: 1 };

export interface MonthRow {
  month: number; // 1-based
  label: string; // "Y1 M03"
  units: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  ebitda: number;
  depreciation: number;
  interest: number;
  tax: number;
  netProfit: number;
  /** Operating cash only — excludes capex and financing. */
  operatingCashFlow: number;
  /** Loan interest plus principal repaid this month. */
  debtService: number;
  /** operatingCashFlow − debtService. Reconciles exactly with cashBalance. */
  netCashFlow: number;
  /** Bank balance: opening funding, less capex, plus operating and financing flows. */
  cashBalance: number;
}

export interface YearRow {
  year: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  opex: number;
  ebitda: number;
  ebitdaMarginPercent: number;
  depreciation: number;
  interest: number;
  taxableProfit: number;
  tax: number;
  netProfit: number;
  netMarginPercent: number;
}

export interface BreakEven {
  /** First month EBITDA turns non-negative. */
  operatingMonth: number | null;
  /** First month cumulative operating cash repays the total investment. */
  paybackMonth: number | null;
  /** Monthly revenue at which contribution exactly covers fixed cost. */
  monthlyRevenue: number;
  /** The same point expressed in blended units per month. */
  unitsPerMonth: number | null;
  unitLabel: string;
  contributionMarginPercent: number;
  fixedMonthlyCost: number;
}

export interface FundingRequirement {
  totalCapex: number;
  /** Deepest cumulative operating cash deficit before the business self-funds. */
  peakOperatingDeficit: number;
  /** working_capital_months × month-one operating cost. */
  workingCapitalBuffer: number;
  /** CapEx plus whichever of the two above binds. */
  total: number;
  equity: number;
  debt: number;
  ownerCapital: number;
  useOfFunds: { purpose: string; amount: number }[];
  /** Lowest projected bank balance — negative means the plan is underfunded. */
  minimumCashBalance: number;
  fundingGap: number;
}

export interface ReturnMetrics {
  totalInvestment: number;
  cumulativeNetProfit: number;
  roiPercent: number;
  paybackMonths: number | null;
  irrPercent: number | null;
  npv: number;
  discountRatePercent: number;
  /** Year 0 = −investment, then one free-cash-flow entry per projected year. */
  cashFlows: number[];
}

export interface Scenario {
  name: "Best case" | "Base case" | "Worst case";
  description: string;
  year1Revenue: number;
  year1Ebitda: number;
  finalYearRevenue: number;
  paybackMonth: number | null;
  roiPercent: number;
  irrPercent: number | null;
  npv: number;
}

export interface SensitivityRow {
  variable: "Price" | "Volume" | "Operating cost";
  change: string; // "-10%"
  year1Ebitda: number;
  paybackMonth: number | null;
  npv: number;
}

/**
 * How the modelled economics compare with the figures the applicant supplied.
 *
 * The specialist is told to model what it believes is true rather than echo the
 * brief, so a study can legitimately conclude "not viable" while the six-
 * dimension scorecard — which scores the applicant's own numbers — reads
 * healthy. Surfacing the gap is what makes those two views readable together.
 */
export interface Reconciliation {
  statedMonthlyRevenue: number;
  modelledMonthlyRevenue: number;
  revenueVariancePercent: number;
  statedMonthlyCost: number;
  modelledMonthlyCost: number;
  costVariancePercent: number;
  /** True when either side differs by more than 20%. */
  materiallyDifferent: boolean;
}

export interface Projections {
  currency: string;
  projectionYears: number;
  reconciliation: Reconciliation | null;
  monthly: MonthRow[]; // full horizon; year 1 is monthly[0..11]
  annual: YearRow[];
  breakEven: BreakEven;
  funding: FundingRequirement;
  returns: ReturnMetrics;
  scenarios: Scenario[];
  sensitivity: SensitivityRow[];
  capexTotal: number;
  capexByCategory: { category: string; amount: number }[];
  opexMonthlyTotal: number;
  opexByCategory: { category: string; monthly: number; annual: number }[];
  revenueByStream: { name: string; year1: number; finalYear: number; unitLabel: string }[];
}

// --- core engine ------------------------------------------------------------

interface CoreResult {
  monthly: MonthRow[];
  annual: YearRow[];
  totalCapex: number;
  peakOperatingDeficit: number;
  minimumCashBalance: number;
  paybackMonth: number | null;
  totalInvestment: number;
  annualFreeCashFlow: number[];
}

/** Normalise the seasonality vector to exactly 12 entries averaging 1.0. */
function normalizedSeasonality(raw: number[]): number[] {
  const twelve = Array.from({ length: 12 }, (_, i) => {
    const v = raw[i];
    return typeof v === "number" && isFinite(v) && v > 0 ? v : 1;
  });
  const mean = twelve.reduce((a, b) => a + b, 0) / 12;
  return mean > 0 ? twelve.map((v) => v / mean) : twelve.map(() => 1);
}

function project(model: FinancialModel, flex: Flex): CoreResult {
  const a = model.assumptions;
  const years = clamp(Math.round(a.projection_years), 3, 5);
  const months = years * 12;
  const season = normalizedSeasonality(a.seasonality_index);
  const inflation = a.cost_inflation_percent / 100;
  const taxRate = a.tax_rate_percent / 100;

  const totalCapex = model.capex.reduce((s, c) => s + c.amount, 0);
  const depreciableCapex = model.capex.filter((c) => c.depreciable).reduce((s, c) => s + c.amount, 0);
  const depreciationMonths = Math.max(1, Math.round(a.depreciation_years * 12));
  const monthlyDepreciation = depreciableCapex / depreciationMonths;

  const fixedOpexBase = model.opex
    .filter((o) => !o.variable_with_revenue)
    .reduce((s, o) => s + o.monthly_amount, 0);
  const variableOpexBase = model.opex
    .filter((o) => o.variable_with_revenue)
    .reduce((s, o) => s + o.monthly_amount, 0);

  // Reference point for scaling revenue-linked OpEx: total mature monthly revenue.
  const matureRevenue = model.revenue_streams.reduce((s, r) => s + matureMonthlyRevenue(r), 0);

  // Two passes, because the inputs are genuinely circular: tax needs the
  // interest deduction, interest needs the debt balance, the debt balance is a
  // share of the funding requirement, and the requirement depends on the cash
  // the business burns — which is after tax.
  //
  // Pass 1 computes trading only (revenue through EBITDA) and sizes the funding
  // from the EBITDA deficit. That is exact for sizing: while the business is
  // burning cash, EBITDA is negative and tax is zero, so tax cannot change the
  // trough. Pass 2 then knows the debt schedule and computes interest and tax
  // together, in the right order.
  type Trading = Pick<
    MonthRow,
    "month" | "label" | "units" | "revenue" | "cogs" | "grossProfit" | "opex" | "ebitda" | "depreciation"
  >;
  const trading: Trading[] = [];

  for (let m = 1; m <= months; m++) {
    const yearIndex = Math.floor((m - 1) / 12); // 0-based
    const growth = growthFactor(a.revenue_growth_percent_by_year, yearIndex);
    const inflationFactor = Math.pow(1 + inflation, yearIndex);
    const seasonFactor = season[(m - 1) % 12];

    let units = 0;
    let revenue = 0;
    let cogs = 0;
    for (const s of model.revenue_streams) {
      const ramp = s.ramp_months > 0 ? Math.min(1, m / s.ramp_months) : 1;
      const streamUnits =
        s.units_per_month *
        (s.utilization_percent / 100) *
        flex.volume *
        ramp *
        seasonFactor *
        growth;
      // Unit economics: price flexes, unit cost inflates but does not follow price.
      const unitCost = s.price_per_unit * (s.cogs_percent / 100) * inflationFactor;
      units += streamUnits;
      revenue += streamUnits * s.price_per_unit * flex.price;
      cogs += streamUnits * unitCost;
    }

    const revenueRatio = matureRevenue > 0 ? revenue / matureRevenue : 0;
    const opex =
      fixedOpexBase * flex.opex * inflationFactor + variableOpexBase * flex.opex * revenueRatio;

    trading.push({
      month: m,
      label: `Y${yearIndex + 1} M${String(((m - 1) % 12) + 1).padStart(2, "0")}`,
      units,
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      opex,
      ebitda: revenue - cogs - opex,
      depreciation: m <= depreciationMonths ? monthlyDepreciation : 0,
    });
  }

  // Funding requirement: capex plus whichever of the operating deficit or the
  // stated working-capital buffer is larger.
  let running = 0;
  let peakOperatingDeficit = 0;
  for (const t of trading) {
    running += t.ebitda;
    if (running < 0) peakOperatingDeficit = Math.max(peakOperatingDeficit, -running);
  }
  const workingCapitalBuffer = a.working_capital_months * (trading[0]?.opex ?? 0);
  const totalInvestment = totalCapex + Math.max(peakOperatingDeficit, workingCapitalBuffer);

  // Debt service on the portion of that requirement funded by debt.
  const debtPrincipal = totalInvestment * (model.funding.debt_percent / 100);
  const debtMonths = Math.round(model.funding.debt_term_years * 12);
  const monthlyPrincipal = debtMonths > 0 ? debtPrincipal / debtMonths : 0;
  const monthlyRate = model.funding.debt_interest_percent / 100 / 12;

  const monthly: MonthRow[] = [];
  let debtBalance = debtPrincipal;
  let cash = totalInvestment - totalCapex; // funding drawn, capex spent at opening
  let cumulativeOperating = -totalInvestment;
  let paybackMonth: number | null = null;
  let minimumCashBalance = cash;

  let lossCarryforward = 0;

  for (const t of trading) {
    const interest = debtBalance > 0 ? debtBalance * monthlyRate : 0;
    const principal = debtBalance > 0 ? Math.min(monthlyPrincipal, debtBalance) : 0;
    debtBalance = Math.max(0, debtBalance - principal);

    // Interest is deductible, so it has to be known before tax is charged.
    const preTax = t.ebitda - t.depreciation - interest;
    const { tax, carry } = applyTax(preTax, lossCarryforward, taxRate);
    lossCarryforward = carry;

    const operatingCashFlow = t.ebitda - tax;
    const debtService = interest + principal;
    const netCashFlow = operatingCashFlow - debtService;
    cash += netCashFlow;
    minimumCashBalance = Math.min(minimumCashBalance, cash);

    cumulativeOperating += operatingCashFlow;
    if (paybackMonth === null && cumulativeOperating >= 0) paybackMonth = t.month;

    monthly.push({
      ...t,
      interest,
      tax,
      netProfit: preTax - tax,
      operatingCashFlow,
      debtService,
      netCashFlow,
      cashBalance: cash,
    });
  }

  const annual = aggregateYears(monthly);
  const annualFreeCashFlow = annual.map((y) => y.ebitda - y.tax);

  return {
    monthly,
    annual,
    totalCapex,
    peakOperatingDeficit,
    minimumCashBalance,
    paybackMonth,
    totalInvestment,
    annualFreeCashFlow,
  };
}

function applyTax(preTax: number, carry: number, rate: number): { tax: number; carry: number } {
  if (preTax <= 0) return { tax: 0, carry: carry - preTax };
  const used = Math.min(carry, preTax);
  const taxable = preTax - used;
  return { tax: taxable * rate, carry: carry - used };
}

function growthFactor(growthByYear: number[], yearIndex: number): number {
  let f = 1;
  for (let y = 0; y < yearIndex; y++) {
    const g = growthByYear[y];
    f *= 1 + (typeof g === "number" && isFinite(g) ? g : 0) / 100;
  }
  return f;
}

function aggregateYears(monthly: MonthRow[]): YearRow[] {
  const years = Math.ceil(monthly.length / 12);
  const out: YearRow[] = [];
  for (let y = 0; y < years; y++) {
    const slice = monthly.slice(y * 12, y * 12 + 12);
    const sum = (pick: (r: MonthRow) => number) => slice.reduce((s, r) => s + pick(r), 0);
    const revenue = sum((r) => r.revenue);
    const cogs = sum((r) => r.cogs);
    const grossProfit = revenue - cogs;
    const opex = sum((r) => r.opex);
    const ebitda = grossProfit - opex;
    const depreciation = sum((r) => r.depreciation);
    const interest = sum((r) => r.interest);
    const tax = sum((r) => r.tax);
    const taxableProfit = ebitda - depreciation - interest;
    out.push({
      year: y + 1,
      revenue,
      cogs,
      grossProfit,
      grossMarginPercent: pctOf(grossProfit, revenue),
      opex,
      ebitda,
      ebitdaMarginPercent: pctOf(ebitda, revenue),
      depreciation,
      interest,
      taxableProfit,
      tax,
      netProfit: taxableProfit - tax,
      netMarginPercent: pctOf(taxableProfit - tax, revenue),
    });
  }
  return out;
}

// --- public entry point -----------------------------------------------------

export function buildProjections(
  model: FinancialModel,
  stated?: { monthlyCost: number; monthlyRevenue: number }
): Projections {
  const base = project(model, BASE);

  const breakEven = computeBreakEven(model, base);
  const funding = computeFunding(model, base);
  const returns = computeReturns(model, base);

  const scenarios: Scenario[] = [
    scenario("Best case", "Price +10%, volume +15%, operating cost −5%", model, {
      price: 1.1,
      volume: 1.15,
      opex: 0.95,
    }),
    scenario("Base case", "The model exactly as stated", model, BASE),
    scenario("Worst case", "Price −10%, volume −20%, operating cost +10%", model, {
      price: 0.9,
      volume: 0.8,
      opex: 1.1,
    }),
  ];

  const sensitivity: SensitivityRow[] = [
    ...oneWay(model, "Price", "price"),
    ...oneWay(model, "Volume", "volume"),
    ...oneWay(model, "Operating cost", "opex"),
  ];

  return {
    currency: model.currency || "USD",
    projectionYears: base.annual.length,
    reconciliation: stated ? reconcile(model, stated) : null,
    monthly: base.monthly,
    annual: base.annual,
    breakEven,
    funding,
    returns,
    scenarios,
    sensitivity,
    capexTotal: base.totalCapex,
    capexByCategory: groupSum(model.capex, (c) => c.category, (c) => c.amount).map(
      ([category, amount]) => ({ category, amount })
    ),
    opexMonthlyTotal: model.opex.reduce((s, o) => s + o.monthly_amount, 0),
    opexByCategory: groupSum(model.opex, (o) => o.category, (o) => o.monthly_amount).map(
      ([category, monthly]) => ({ category, monthly, annual: monthly * 12 })
    ),
    revenueByStream: model.revenue_streams.map((s) => {
      const share =
        totalMature(model) > 0 ? matureMonthlyRevenue(s) / totalMature(model) : 0;
      const finalYear = base.annual[base.annual.length - 1]?.revenue ?? 0;
      return {
        name: s.name,
        year1: (base.annual[0]?.revenue ?? 0) * share,
        finalYear: finalYear * share,
        unitLabel: s.unit_label,
      };
    }),
  };
}

const totalMature = (model: FinancialModel) =>
  model.revenue_streams.reduce((s, r) => s + matureMonthlyRevenue(r), 0);

function reconcile(
  model: FinancialModel,
  stated: { monthlyCost: number; monthlyRevenue: number }
): Reconciliation {
  const modelledMonthlyRevenue = totalMature(model);
  const modelledCogs = model.revenue_streams.reduce(
    (s, r) => s + matureMonthlyRevenue(r) * (r.cogs_percent / 100),
    0
  );
  const modelledMonthlyCost =
    modelledCogs + model.opex.reduce((s, o) => s + o.monthly_amount, 0);

  const variance = (modelled: number, statedValue: number) =>
    statedValue > 0 ? round1(((modelled - statedValue) / statedValue) * 100) : 0;

  const revenueVariancePercent = variance(modelledMonthlyRevenue, stated.monthlyRevenue);
  const costVariancePercent = variance(modelledMonthlyCost, stated.monthlyCost);

  return {
    statedMonthlyRevenue: stated.monthlyRevenue,
    modelledMonthlyRevenue,
    revenueVariancePercent,
    statedMonthlyCost: stated.monthlyCost,
    modelledMonthlyCost,
    costVariancePercent,
    materiallyDifferent:
      Math.abs(revenueVariancePercent) > 20 || Math.abs(costVariancePercent) > 20,
  };
}

function computeBreakEven(model: FinancialModel, base: CoreResult): BreakEven {
  const mature = totalMature(model);
  const matureUnits = model.revenue_streams.reduce(
    (s, r) => s + r.units_per_month * (r.utilization_percent / 100),
    0
  );
  const matureCogs = model.revenue_streams.reduce(
    (s, r) => s + matureMonthlyRevenue(r) * (r.cogs_percent / 100),
    0
  );
  const variableOpex = model.opex
    .filter((o) => o.variable_with_revenue)
    .reduce((s, o) => s + o.monthly_amount, 0);
  const fixedMonthlyCost = model.opex
    .filter((o) => !o.variable_with_revenue)
    .reduce((s, o) => s + o.monthly_amount, 0);

  const contribution = mature - matureCogs - variableOpex;
  const contributionRatio = mature > 0 ? contribution / mature : 0;
  const monthlyRevenue = contributionRatio > 0 ? fixedMonthlyCost / contributionRatio : 0;
  const blendedPrice = matureUnits > 0 ? mature / matureUnits : 0;

  const operatingMonth = base.monthly.find((m) => m.ebitda >= 0)?.month ?? null;

  return {
    operatingMonth,
    paybackMonth: base.paybackMonth,
    monthlyRevenue,
    unitsPerMonth: blendedPrice > 0 ? monthlyRevenue / blendedPrice : null,
    unitLabel: model.revenue_streams[0]?.unit_label ?? "units",
    contributionMarginPercent: round1(contributionRatio * 100),
    fixedMonthlyCost,
  };
}

function computeFunding(model: FinancialModel, base: CoreResult): FundingRequirement {
  const f = model.funding;
  const workingCapitalBuffer =
    model.assumptions.working_capital_months * (base.monthly[0]?.opex ?? 0);
  const total = base.totalInvestment;
  const split = (p: number) => (total * p) / 100;

  // Derived from the CapEx categories and the working capital the cash profile
  // actually demands, so the use of funds always sums to the requirement above.
  // Taking a use-of-funds list from the model instead would let the two
  // disagree on the same page.
  const useOfFunds = [
    ...groupSum(model.capex, (c) => c.category, (c) => c.amount).map(([purpose, amount]) => ({
      purpose,
      amount,
    })),
    { purpose: "Working capital", amount: total - base.totalCapex },
  ].filter((u) => u.amount > 0);

  return {
    totalCapex: base.totalCapex,
    peakOperatingDeficit: base.peakOperatingDeficit,
    workingCapitalBuffer,
    total,
    equity: split(f.equity_percent),
    debt: split(f.debt_percent),
    ownerCapital: split(f.owner_capital_percent),
    useOfFunds,
    minimumCashBalance: base.minimumCashBalance,
    fundingGap: base.minimumCashBalance < 0 ? -base.minimumCashBalance : 0,
  };
}

function computeReturns(model: FinancialModel, base: CoreResult): ReturnMetrics {
  const discountRate = model.assumptions.discount_rate_percent;
  const cashFlows = [-base.totalInvestment, ...base.annualFreeCashFlow];
  const cumulativeNetProfit = base.annual.reduce((s, y) => s + y.netProfit, 0);

  return {
    totalInvestment: base.totalInvestment,
    cumulativeNetProfit,
    roiPercent:
      base.totalInvestment > 0 ? round1((cumulativeNetProfit / base.totalInvestment) * 100) : 0,
    paybackMonths: base.paybackMonth,
    irrPercent: irr(cashFlows),
    npv: npv(cashFlows, discountRate / 100),
    discountRatePercent: discountRate,
    cashFlows,
  };
}

function scenario(
  name: Scenario["name"],
  description: string,
  model: FinancialModel,
  flex: Flex
): Scenario {
  const r = project(model, flex);
  const flows = [-r.totalInvestment, ...r.annualFreeCashFlow];
  const cumulativeNetProfit = r.annual.reduce((s, y) => s + y.netProfit, 0);
  return {
    name,
    description,
    year1Revenue: r.annual[0]?.revenue ?? 0,
    year1Ebitda: r.annual[0]?.ebitda ?? 0,
    finalYearRevenue: r.annual[r.annual.length - 1]?.revenue ?? 0,
    paybackMonth: r.paybackMonth,
    roiPercent: r.totalInvestment > 0 ? round1((cumulativeNetProfit / r.totalInvestment) * 100) : 0,
    irrPercent: irr(flows),
    npv: npv(flows, model.assumptions.discount_rate_percent / 100),
  };
}

function oneWay(
  model: FinancialModel,
  variable: SensitivityRow["variable"],
  key: keyof Flex
): SensitivityRow[] {
  return [-10, 10].map((delta) => {
    const r = project(model, { ...BASE, [key]: 1 + delta / 100 });
    const flows = [-r.totalInvestment, ...r.annualFreeCashFlow];
    return {
      variable,
      change: `${delta > 0 ? "+" : ""}${delta}%`,
      year1Ebitda: r.annual[0]?.ebitda ?? 0,
      paybackMonth: r.paybackMonth,
      npv: npv(flows, model.assumptions.discount_rate_percent / 100),
    };
  });
}

// --- finance primitives -----------------------------------------------------

export function npv(flows: number[], rate: number): number {
  return Math.round(flows.reduce((s, f, i) => s + f / Math.pow(1 + rate, i), 0));
}

/** Project IRR by bisection. Returns null when the flows never cross zero. */
export function irr(flows: number[]): number | null {
  const at = (r: number) => flows.reduce((s, f, i) => s + f / Math.pow(1 + r, i), 0);
  let lo = -0.9999;
  let hi = 10;
  let flo = at(lo);
  let fhi = at(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = at(mid);
    if (Math.abs(fm) < 1e-6) return round1(mid * 100);
    if (flo * fm < 0) {
      hi = mid;
      fhi = fm;
    } else {
      lo = mid;
      flo = fm;
    }
  }
  return round1(((lo + hi) / 2) * 100);
}

function groupSum<T>(items: T[], key: (t: T) => string, value: (t: T) => number): [string, number][] {
  const map = new Map<string, number>();
  for (const it of items) map.set(key(it), (map.get(key(it)) ?? 0) + value(it));
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

const pctOf = (n: number, d: number) => (d > 0 ? round1((n / d) * 100) : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
