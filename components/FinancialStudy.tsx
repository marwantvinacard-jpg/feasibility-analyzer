"use client";

// The Financial Feasibility Study — the standard 15-section outline.
//
// Numbers rendered here all come from result.study.projections, which is
// computed in code (lib/engine/projections.ts). The prose comes from
// study.narrative. Nothing is calculated in this component beyond formatting,
// so the web view, the print view and the PDF can never disagree.

import { Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { money, cn, type Tone } from "@/lib/ui";
import type { FinancialStudy as Study } from "@/lib/engine/study";
import type { MonthRow } from "@/lib/engine/projections";
import type { BusinessInput } from "@/lib/engine/types";
import { useT } from "@/lib/i18n/LanguageContext";

const VERDICT_TONE: Record<Study["narrative"]["verdict"], Tone> = {
  Viable: "go",
  "Viable with conditions": "warn",
  "Not viable": "stop",
};

export function FinancialStudyView({
  study,
  input,
  print = false,
}: {
  study: Study;
  input: BusinessInput;
  print?: boolean;
}) {
  const t = useT();
  const { model, projections: p, narrative: n } = study;
  const cur = p.currency;
  const f = (v: number) => money(v, cur);
  const vtone = VERDICT_TONE[n.verdict];

  return (
    <div className="space-y-5">
      {/* ---------------------------------------------------------- 1 */}
      <StudySection n={1} title={t("study.s1title")}>
        <Badge tone={vtone} className="mb-3">
          <Icon name={vtone === "go" ? "check" : vtone === "warn" ? "clock" : "x"} size={13} strokeWidth={2.5} />
          {n.verdict}
        </Badge>
        <Prose>{n.executive_summary}</Prose>
        <p className="mt-3 rounded-xl border border-brand/25 bg-brand/5 p-3.5 text-sm text-ink">
          <span className="label mb-1 block text-brand">{t("study.investmentAsk")}</span>
          {n.investment_ask}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label={t("study.totalCapitalRequired")} value={f(p.funding.total)} />
          <Tile
            label={t("study.payback")}
            value={p.returns.paybackMonths === null ? t("study.beyondHorizon") : t("study.monthsShort", { n: p.returns.paybackMonths })}
            tone={p.returns.paybackMonths === null ? "stop" : "go"}
          />
          <Tile
            label={t("study.irrYears", { years: p.projectionYears })}
            value={p.returns.irrPercent === null ? t("study.na") : `${p.returns.irrPercent}%`}
            tone={irrTone(p.returns.irrPercent, p.returns.discountRatePercent)}
          />
          <Tile
            label={t("study.npvAt", { rate: p.returns.discountRatePercent })}
            value={f(p.returns.npv)}
            tone={p.returns.npv >= 0 ? "go" : "stop"}
          />
        </div>
      </StudySection>

      {/* ---------------------------------------------------------- 2 */}
      <StudySection n={2} title={t("study.s2title")}>
        <Prose>{n.project_overview}</Prose>
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Fact k={t("study.concept")} v={input.business_idea} />
          <Fact k={t("study.productService")} v={input.product_service} />
          <Fact k={t("study.targetMarket")} v={input.target_customer} />
          <Fact k={t("study.location")} v={input.location} />
          <Fact k={t("study.revenueModel")} v={input.revenue_model} />
          <Fact k={t("study.positioning")} v={input.unique_advantage} />
        </dl>
      </StudySection>

      {/* ---------------------------------------------------------- 3 */}
      <StudySection n={3} title={t("study.s3title")} subtitle={t("study.s3sub")}>
        <Prose>{n.market_basis}</Prose>
        {model.pricing_benchmarks.length > 0 && (
          <Table className="mt-4" head={[t("study.thReference"), t("study.thPricePoint"), t("study.thNote")]}>
            {model.pricing_benchmarks.map((b, i) => (
              <tr key={i}>
                <Td>{b.reference}</Td>
                <Td className="num whitespace-nowrap">{b.price_point}</Td>
                <Td className="text-muted">{b.note}</Td>
              </tr>
            ))}
          </Table>
        )}
      </StudySection>

      {/* ---------------------------------------------------------- 4 */}
      <StudySection
        n={4}
        title={t("study.s4title")}
        subtitle={t("study.s4sub", { total: f(p.capexTotal) })}
      >
        <Table head={[t("study.thCategory"), t("study.thAmount", { cur }), t("study.thShare")]} align={[, "right", "right"]}>
          {p.capexByCategory.map((c) => (
            <tr key={c.category}>
              <Td>{c.category}</Td>
              <Td className="num text-right">{f(c.amount)}</Td>
              <Td className="num text-right text-muted">
                {p.capexTotal > 0 ? Math.round((c.amount / p.capexTotal) * 100) : 0}%
              </Td>
            </tr>
          ))}
          <tr className="border-t-2 border-border font-semibold">
            <Td>{t("study.total")}</Td>
            <Td className="num text-right">{f(p.capexTotal)}</Td>
            <Td className="num text-right">100%</Td>
          </tr>
        </Table>
        <LineItems open={print} label={t("study.capexLineItems", { n: model.capex.length })}>
          {model.capex.map((c, i) => (
            <LineItem
              key={i}
              title={c.item}
              tag={c.category}
              value={f(c.amount)}
              basis={c.basis}
              note={c.depreciable ? t("study.depreciable") : t("study.nonDepreciable")}
            />
          ))}
        </LineItems>
      </StudySection>

      {/* ---------------------------------------------------------- 5 */}
      <StudySection
        n={5}
        title={t("study.s5title")}
        subtitle={t("study.s5sub", { monthly: f(p.opexMonthlyTotal), annual: f(p.opexMonthlyTotal * 12) })}
      >
        <Table head={[t("study.thCategory"), t("study.thMonthly", { cur }), t("study.thAnnual", { cur })]} align={[, "right", "right"]}>
          {p.opexByCategory.map((o) => (
            <tr key={o.category}>
              <Td>{o.category}</Td>
              <Td className="num text-right">{f(o.monthly)}</Td>
              <Td className="num text-right text-muted">{f(o.annual)}</Td>
            </tr>
          ))}
          <tr className="border-t-2 border-border font-semibold">
            <Td>{t("study.total")}</Td>
            <Td className="num text-right">{f(p.opexMonthlyTotal)}</Td>
            <Td className="num text-right">{f(p.opexMonthlyTotal * 12)}</Td>
          </tr>
        </Table>
        <Prose className="mt-3">{n.opex_commentary}</Prose>
        <LineItems open={print} label={t("study.opexLineItems", { n: model.opex.length })}>
          {model.opex.map((o, i) => (
            <LineItem
              key={i}
              title={o.item}
              tag={o.category}
              value={t("study.perMonth", { v: f(o.monthly_amount) })}
              basis={o.basis}
              note={o.variable_with_revenue ? t("study.variableWithRevenue") : t("study.fixed")}
            />
          ))}
        </LineItems>
      </StudySection>

      {/* ---------------------------------------------------------- 6 */}
      <StudySection n={6} title={t("study.s6title")} subtitle={t("study.s6sub")}>
        <Table
          head={[t("study.thStream"), t("study.thVolumeMonth"), t("study.thPrice"), t("study.thUtilisation"), t("study.thCogs"), t("study.thRamp")]}
          align={[, "right", "right", "right", "right", "right"]}
        >
          {model.revenue_streams.map((s, i) => (
            <tr key={i}>
              <Td>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-faint">{s.unit_label}</div>
              </Td>
              <Td className="num text-right">{Math.round(s.units_per_month).toLocaleString()}</Td>
              <Td className="num text-right">{f(s.price_per_unit)}</Td>
              <Td className="num text-right text-muted">{s.utilization_percent}%</Td>
              <Td className="num text-right text-muted">{s.cogs_percent}%</Td>
              <Td className="num text-right text-muted">{t("study.monthsShort", { n: s.ramp_months })}</Td>
            </tr>
          ))}
        </Table>
        <Table className="mt-4" head={[t("study.thYear"), ...p.annual.map((y) => `Y${y.year}`)]} align={[, "right", "right", "right", "right", "right"]}>
          <tr>
            <Td className="font-medium">{t("study.revenueCur", { cur })}</Td>
            {p.annual.map((y) => (
              <Td key={y.year} className="num text-right">{f(y.revenue)}</Td>
            ))}
          </tr>
          <tr>
            <Td className="text-muted">{t("study.changeVsPriorYear")}</Td>
            {p.annual.map((y, i) => (
              <Td key={y.year} className="num text-right text-muted">
                {i === 0 ? "—" : `${pctChange(p.annual[i - 1].revenue, y.revenue)}%`}
              </Td>
            ))}
          </tr>
        </Table>
        <Prose className="mt-3">{n.revenue_commentary}</Prose>
      </StudySection>

      {/* ---------------------------------------------------------- 7 */}
      <StudySection n={7} title={t("study.s7title")} subtitle={t("study.s7sub")}>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label={t("study.projectionHorizon")} value={t("study.years", { n: p.projectionYears })} />
          <Tile label={t("study.costInflation")} value={t("study.perYear", { n: model.assumptions.cost_inflation_percent })} />
          <Tile label={t("study.discountRate")} value={`${model.assumptions.discount_rate_percent}%`} />
          <Tile label={t("study.taxRate")} value={`${model.assumptions.tax_rate_percent}%`} />
        </div>
        {p.reconciliation && (
          <div
            className={cn(
              "mt-4 rounded-xl border p-4",
              p.reconciliation.materiallyDifferent ? "border-warn/30 bg-warn/5" : "border-border bg-surface-2"
            )}
          >
            <div className={cn("label mb-2 flex items-center gap-1.5", p.reconciliation.materiallyDifferent && "text-warn")}>
              {p.reconciliation.materiallyDifferent && <Icon name="clock" size={13} />}
              {t("study.reconciliationTitle")}
            </div>
            <Table head={["", t("study.thYouStated"), t("study.thThisModel"), t("study.thVariance")]} align={[, "right", "right", "right"]}>
              <tr>
                <Td className="text-muted">{t("study.monthlyRevenueMaturity")}</Td>
                <Td className="num text-right">{f(p.reconciliation.statedMonthlyRevenue)}</Td>
                <Td className="num text-right">{f(p.reconciliation.modelledMonthlyRevenue)}</Td>
                <Td className="num text-right">{signed(p.reconciliation.revenueVariancePercent)}</Td>
              </tr>
              <tr>
                <Td className="text-muted">{t("study.monthlyCostMaturity")}</Td>
                <Td className="num text-right">{f(p.reconciliation.statedMonthlyCost)}</Td>
                <Td className="num text-right">{f(p.reconciliation.modelledMonthlyCost)}</Td>
                <Td className="num text-right">{signed(p.reconciliation.costVariancePercent)}</Td>
              </tr>
            </Table>
            {p.reconciliation.materiallyDifferent && (
              <p className="mt-2.5 text-xs leading-relaxed text-muted">{t("study.reconciliationNote")}</p>
            )}
          </div>
        )}
        <Table className="mt-4" head={[t("study.thArea"), t("study.thAssumption"), t("study.thValue"), t("study.thBasis"), t("study.thConfidence")]}>
          {model.assumption_notes.map((a, i) => (
            <tr key={i}>
              <Td><Badge>{a.area}</Badge></Td>
              <Td>{a.assumption}</Td>
              <Td className="num whitespace-nowrap">{a.value}</Td>
              <Td className="text-muted">{a.basis}</Td>
              <Td>
                <span className={cn("text-xs font-semibold", a.confidence === "High" ? "text-go" : a.confidence === "Medium" ? "text-warn" : "text-stop")}>
                  {a.confidence}
                </span>
              </Td>
            </tr>
          ))}
        </Table>
        <Prose className="mt-3">{n.assumptions_commentary}</Prose>
        {model.exclusions.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-surface-2 p-4">
            <div className="label mb-2">{t("study.excludedTitle")}</div>
            <ul className="space-y-1.5 text-sm text-muted">
              {model.exclusions.map((e, i) => (
                <li key={i} className="flex gap-2"><span className="text-faint">·</span>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </StudySection>

      {/* ---------------------------------------------------------- 8 */}
      <StudySection n={8} title={t("study.s8title")} subtitle={t("study.s8sub", { years: p.projectionYears, currency: cur })}>
        <Table head={["", ...p.annual.map((y) => t("study.yearN", { n: y.year }))]} align={[, "right", "right", "right", "right", "right"]}>
          <PlRow label={t("study.pl.revenue")} values={p.annual.map((y) => f(y.revenue))} strong />
          <PlRow label={t("study.pl.cogs")} values={p.annual.map((y) => `(${f(y.cogs)})`)} muted />
          <PlRow label={t("study.pl.grossProfit")} values={p.annual.map((y) => f(y.grossProfit))} strong />
          <PlRow label={t("study.pl.grossMargin")} values={p.annual.map((y) => `${y.grossMarginPercent}%`)} muted />
          <PlRow label={t("study.pl.opex")} values={p.annual.map((y) => `(${f(y.opex)})`)} muted />
          <PlRow label={t("study.pl.ebitda")} values={p.annual.map((y) => f(y.ebitda))} strong tone={p.annual.map((y) => (y.ebitda >= 0 ? "go" : "stop"))} />
          <PlRow label={t("study.pl.ebitdaMargin")} values={p.annual.map((y) => `${y.ebitdaMarginPercent}%`)} muted />
          <PlRow label={t("study.pl.depreciation")} values={p.annual.map((y) => `(${f(y.depreciation)})`)} muted />
          <PlRow label={t("study.pl.interest")} values={p.annual.map((y) => `(${f(y.interest)})`)} muted />
          <PlRow label={t("study.pl.tax")} values={p.annual.map((y) => `(${f(y.tax)})`)} muted />
          <PlRow label={t("study.pl.netProfit")} values={p.annual.map((y) => f(y.netProfit))} strong tone={p.annual.map((y) => (y.netProfit >= 0 ? "go" : "stop"))} />
          <PlRow label={t("study.pl.netMargin")} values={p.annual.map((y) => `${y.netMarginPercent}%`)} muted />
        </Table>
        <Prose className="mt-3">{n.pl_commentary}</Prose>
      </StudySection>

      {/* ---------------------------------------------------------- 9 */}
      <StudySection n={9} title={t("study.s9title")} subtitle={t("study.s9sub")}>
        <CashCurve months={p.monthly.slice(0, 12)} currency={cur} label={t("study.cashBalanceY1")} />
        <Table
          className="mt-4"
          head={[t("study.thMonth"), t("study.thRevenue"), t("study.thEbitda"), t("study.thTax"), t("study.thDebtService"), t("study.thNetCash"), t("study.thBalance")]}
          align={[, "right", "right", "right", "right", "right", "right"]}
        >
          {p.monthly.slice(0, 12).map((m) => (
            <tr key={m.month}>
              <Td className="whitespace-nowrap font-medium">{m.label}</Td>
              <Td className="num text-right">{f(m.revenue)}</Td>
              <Td className={cn("num text-right", m.ebitda >= 0 ? "text-go" : "text-stop")}>{f(m.ebitda)}</Td>
              <Td className="num text-right text-muted">{f(m.tax)}</Td>
              <Td className="num text-right text-muted">{f(m.debtService)}</Td>
              <Td className={cn("num text-right", m.netCashFlow >= 0 ? "text-ink" : "text-stop")}>{f(m.netCashFlow)}</Td>
              <Td className={cn("num text-right font-semibold", m.cashBalance >= 0 ? "text-ink" : "text-stop")}>{f(m.cashBalance)}</Td>
            </tr>
          ))}
        </Table>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          <Tile
            label={t("study.lowestCashBalance")}
            value={f(p.funding.minimumCashBalance)}
            tone={p.funding.minimumCashBalance >= 0 ? "go" : "stop"}
          />
          <Tile label={t("study.peakOperatingDeficit")} value={f(p.funding.peakOperatingDeficit)} />
          <Tile
            label={t("study.fundingGap")}
            value={p.funding.fundingGap > 0 ? f(p.funding.fundingGap) : t("study.none")}
            tone={p.funding.fundingGap > 0 ? "stop" : "go"}
          />
        </div>
        <Prose className="mt-3">{n.cashflow_commentary}</Prose>
      </StudySection>

      {/* ---------------------------------------------------------- 10 */}
      <StudySection n={10} title={t("study.s10title")}>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label={t("study.operatingBreakEven")}
            value={p.breakEven.operatingMonth === null ? t("study.never") : t("study.monthN", { n: p.breakEven.operatingMonth })}
            tone={p.breakEven.operatingMonth === null ? "stop" : "go"}
          />
          <Tile
            label={t("study.investmentPayback")}
            value={p.breakEven.paybackMonth === null ? t("study.beyondHorizon") : t("study.monthN", { n: p.breakEven.paybackMonth })}
            tone={p.breakEven.paybackMonth === null ? "stop" : "go"}
          />
          <Tile label={t("study.breakEvenRevenue")} value={t("study.perMonth", { v: f(p.breakEven.monthlyRevenue) })} />
          <Tile
            label={t("study.breakEvenVolume", { unit: p.breakEven.unitLabel })}
            value={p.breakEven.unitsPerMonth === null ? t("study.na") : Math.ceil(p.breakEven.unitsPerMonth).toLocaleString()}
          />
        </div>
        <Table className="mt-4" head={["", t("study.thValue")]} align={[, "right"]}>
          <tr>
            <Td className="text-muted">{t("study.contributionMargin")}</Td>
            <Td className="num text-right font-semibold">{p.breakEven.contributionMarginPercent}%</Td>
          </tr>
          <tr>
            <Td className="text-muted">{t("study.fixedMonthlyCost")}</Td>
            <Td className="num text-right font-semibold">{f(p.breakEven.fixedMonthlyCost)}</Td>
          </tr>
        </Table>
        <div className="mt-4">
          <div className="label mb-2">{t("study.sensitivityTitle")}</div>
          <Table head={[t("study.thVariable"), t("study.thChange"), t("study.thYear1Ebitda"), t("study.thPaybackShort"), t("study.thNpv")]} align={[, , "right", "right", "right"]}>
            {p.sensitivity.map((s, i) => (
              <tr key={i}>
                <Td>{s.variable}</Td>
                <Td className={cn("num", s.change.startsWith("+") ? "text-go" : "text-stop")}>{s.change}</Td>
                <Td className="num text-right">{f(s.year1Ebitda)}</Td>
                <Td className="num text-right">{s.paybackMonth === null ? "—" : t("study.monthsShort", { n: s.paybackMonth })}</Td>
                <Td className={cn("num text-right", s.npv >= 0 ? "text-ink" : "text-stop")}>{f(s.npv)}</Td>
              </tr>
            ))}
          </Table>
        </div>
        <Prose className="mt-3">{n.breakeven_commentary}</Prose>
      </StudySection>

      {/* ---------------------------------------------------------- 11 */}
      <StudySection n={11} title={t("study.s11title")}>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <Tile label={t("study.capitalExpenditure")} value={f(p.funding.totalCapex)} />
          <Tile label={t("study.workingCapital")} value={f(Math.max(p.funding.peakOperatingDeficit, p.funding.workingCapitalBuffer))} />
          <Tile label={t("study.totalRequirement")} value={f(p.funding.total)} tone="go" />
        </div>
        <div className="mt-4">
          <div className="label mb-2">{t("study.proposedFundingMix")}</div>
          <FundingBar
            parts={[
              { label: t("study.equity"), amount: p.funding.equity, className: "bg-brand" },
              { label: t("study.debt"), amount: p.funding.debt, className: "bg-warn" },
              { label: t("study.ownerCapital"), amount: p.funding.ownerCapital, className: "bg-go" },
            ]}
            total={p.funding.total}
            currency={cur}
          />
          <p className="mt-2.5 text-xs text-faint">
            {t("study.debtPriced", { rate: model.funding.debt_interest_percent, years: model.funding.debt_term_years, rationale: model.funding.structure_rationale })}
          </p>
        </div>
        {p.funding.useOfFunds.length > 0 && (
          <Table className="mt-4" head={[t("study.useOfFunds"), t("study.thAmount", { cur })]} align={[, "right"]}>
            {p.funding.useOfFunds.map((u, i) => (
              <tr key={i}>
                <Td>{u.purpose}</Td>
                <Td className="num text-right">{f(u.amount)}</Td>
              </tr>
            ))}
          </Table>
        )}
        <Prose className="mt-3">{n.funding_commentary}</Prose>
      </StudySection>

      {/* ---------------------------------------------------------- 12 */}
      <StudySection n={12} title={t("study.s12title")} subtitle={t("study.s12sub", { years: p.projectionYears })}>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label={t("study.cumulativeRoi", { years: p.projectionYears })}
            value={`${p.returns.roiPercent}%`}
            tone={p.returns.roiPercent >= 0 ? "go" : "stop"}
          />
          <Tile
            label={t("study.paybackPeriod")}
            value={p.returns.paybackMonths === null ? t("study.beyondHorizon") : t("study.paybackMonths", { n: p.returns.paybackMonths })}
            tone={p.returns.paybackMonths === null ? "stop" : "go"}
          />
          <Tile
            label={t("study.irr")}
            value={p.returns.irrPercent === null ? t("study.notMeaningful") : `${p.returns.irrPercent}%`}
            tone={irrTone(p.returns.irrPercent, p.returns.discountRatePercent)}
          />
          <Tile label={t("study.npvAt", { rate: p.returns.discountRatePercent })} value={f(p.returns.npv)} tone={p.returns.npv >= 0 ? "go" : "stop"} />
        </div>
        <Table
          className="mt-4"
          head={[t("study.thCashFlow"), ...p.returns.cashFlows.map((_, i) => (i === 0 ? t("study.year0") : t("study.yearN", { n: i })))]}
          align={[, "right", "right", "right", "right", "right", "right"]}
        >
          <tr>
            <Td className="text-muted">{t("study.freeCashFlow", { cur })}</Td>
            {p.returns.cashFlows.map((c, i) => (
              <Td key={i} className={cn("num text-right", c >= 0 ? "text-ink" : "text-stop")}>{f(c)}</Td>
            ))}
          </tr>
        </Table>
        <Prose className="mt-3">{n.returns_commentary}</Prose>
      </StudySection>

      {/* ---------------------------------------------------------- 13 */}
      <StudySection n={13} title={t("study.s13title")} subtitle={t("study.s13sub")}>
        <Table head={[t("study.thRiskCategory"), t("study.thRisk"), t("study.thMitigation")]}>
          {n.financial_risks.map((r, i) => (
            <tr key={i}>
              <Td><Badge tone={r.category === "Currency" || r.category === "Regulatory" ? "warn" : undefined}>{r.category}</Badge></Td>
              <Td className="font-medium">{r.risk}</Td>
              <Td className="text-muted">{r.mitigation}</Td>
            </tr>
          ))}
        </Table>
        <Prose className="mt-3">{n.risk_commentary}</Prose>
      </StudySection>

      {/* ---------------------------------------------------------- 14 */}
      <StudySection n={14} title={t("study.s14title")} subtitle={t("study.s14sub")}>
        <Table
          head={[t("study.thScenario"), t("study.thYear1Revenue"), t("study.thYear1Ebitda"), t("study.thYearNRevenue", { n: p.projectionYears }), t("study.thPaybackShort"), t("study.thRoi"), t("study.irr"), t("study.thNpv")]}
          align={[, "right", "right", "right", "right", "right", "right", "right"]}
        >
          {p.scenarios.map((s) => {
            const tone: Tone = s.name === "Best case" ? "go" : s.name === "Worst case" ? "stop" : "warn";
            return (
              <tr key={s.name}>
                <Td>
                  <div className={cn("font-semibold", tone === "go" ? "text-go" : tone === "stop" ? "text-stop" : "text-ink")}>{s.name}</div>
                  <div className="text-xs text-faint">{s.description}</div>
                </Td>
                <Td className="num text-right">{f(s.year1Revenue)}</Td>
                <Td className="num text-right">{f(s.year1Ebitda)}</Td>
                <Td className="num text-right">{f(s.finalYearRevenue)}</Td>
                <Td className="num text-right">{s.paybackMonth === null ? "—" : t("study.monthsShort", { n: s.paybackMonth })}</Td>
                <Td className="num text-right">{s.roiPercent}%</Td>
                <Td className="num text-right">{s.irrPercent === null ? "—" : `${s.irrPercent}%`}</Td>
                <Td className={cn("num text-right font-semibold", s.npv >= 0 ? "text-ink" : "text-stop")}>{f(s.npv)}</Td>
              </tr>
            );
          })}
        </Table>
        <Prose className="mt-3">{n.sensitivity_commentary}</Prose>
      </StudySection>

      {/* ---------------------------------------------------------- 15 */}
      <StudySection n={15} title={t("study.s15title")}>
        <Badge tone={vtone} className="mb-3">
          <Icon name={vtone === "go" ? "check" : vtone === "warn" ? "clock" : "x"} size={13} strokeWidth={2.5} />
          {n.verdict}
        </Badge>
        <Prose>{n.conclusion}</Prose>
        {n.conditions.length > 0 && (
          <div className="mt-4 rounded-xl border border-warn/25 bg-warn/5 p-4">
            <div className="label mb-2.5 flex items-center gap-1.5 text-warn">
              <Icon name="clock" size={13} /> {t("study.conditionsTitle")}
            </div>
            <ul className="space-y-1.5 text-sm text-muted">
              {n.conditions.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span className="num shrink-0 font-semibold text-warn">{i + 1}</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </StudySection>
    </div>
  );
}

// --- section chrome ---------------------------------------------------------

function StudySection({
  n,
  title,
  subtitle,
  children,
}: {
  n: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="num mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-sm font-bold text-brand">
          {n}
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("whitespace-pre-line text-[0.95rem] leading-relaxed text-muted", className)}>{children}</p>;
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3.5">
      <div
        className={cn(
          "num text-lg font-semibold leading-tight",
          tone === "go" ? "text-go" : tone === "stop" ? "text-stop" : tone === "warn" ? "text-warn" : "text-ink"
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-[0.7rem] leading-snug text-faint">{label}</div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="label mb-0.5">{k}</dt>
      <dd className="text-sm text-muted">{v}</dd>
    </div>
  );
}

function Table({
  head,
  children,
  className,
  align = [],
}: {
  head: string[];
  children: React.ReactNode;
  className?: string;
  align?: (string | undefined)[];
}) {
  return (
    <div className={cn("-mx-1 overflow-x-auto px-1", className)}>
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-border">
            {head.map((h, i) => (
              <th
                key={i}
                className={cn(
                  "label whitespace-nowrap py-2 font-semibold",
                  align[i] === "right" ? "text-right" : "text-left"
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border align-top">{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("py-2.5 pr-3 last:pr-0", className)}>{children}</td>;
}

function PlRow({
  label,
  values,
  strong,
  muted,
  tone,
}: {
  label: string;
  values: string[];
  strong?: boolean;
  muted?: boolean;
  tone?: Tone[];
}) {
  return (
    <tr className={cn(strong && "font-semibold")}>
      <Td className={cn("whitespace-nowrap", muted && "text-muted")}>{label}</Td>
      {values.map((v, i) => (
        <Td
          key={i}
          className={cn(
            "num text-right",
            muted && "text-muted",
            tone?.[i] === "go" ? "text-go" : tone?.[i] === "stop" ? "text-stop" : ""
          )}
        >
          {v}
        </Td>
      ))}
    </tr>
  );
}

function LineItems({ label, open, children }: { label: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="group mt-3 rounded-xl border border-border bg-surface-2 p-4" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
        {label}
        <Icon name="chevron" size={16} className="text-faint transition group-open:rotate-180" />
      </summary>
      <div className="mt-3 space-y-2.5">{children}</div>
    </details>
  );
}

function LineItem({
  title,
  tag,
  value,
  basis,
  note,
}: {
  title: string;
  tag: string;
  value: string;
  basis: string;
  note: string;
}) {
  const t = useT();
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge className="mb-1.5">{tag}</Badge>
          <div className="text-sm font-medium">{title}</div>
        </div>
        <div className="num shrink-0 text-sm font-semibold">{value}</div>
      </div>
      <div className="mt-1.5 text-xs text-muted">
        <span className="text-faint">{t("study.basisPrefix")}</span> {basis} <span className="text-faint">· {note}</span>
      </div>
    </div>
  );
}

/** Year-one cash balance trajectory — makes the funding trough visible at a glance. */
function CashCurve({ months, currency, label }: { months: MonthRow[]; currency: string; label: string }) {
  const values = months.map((m) => m.cashBalance);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const zeroY = (max / span) * 100;

  return (
    <div>
      <div className="label mb-2">{label}</div>
      <div className="relative flex h-28 items-end gap-1 rounded-xl border border-border bg-surface-2 p-2">
        <div
          className="pointer-events-none absolute inset-x-2 border-t border-dashed border-faint/40"
          style={{ top: `calc(${zeroY}% )` }}
        />
        {months.map((m, i) => {
          const v = values[i];
          const height = (Math.abs(v) / span) * 100;
          const positive = v >= 0;
          return (
            <div key={i} className="group/bar relative flex flex-1 flex-col justify-end" style={{ height: "100%" }}>
              <div
                className={cn("w-full rounded-sm", positive ? "bg-go/70" : "bg-stop/70")}
                style={{
                  height: `${height}%`,
                  marginTop: positive ? "auto" : `${zeroY}%`,
                }}
                title={`${m.label}: ${money(v, currency)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[0.65rem] text-faint">
        <span>{months[0]?.label}</span>
        <span>{months[months.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function FundingBar({
  parts,
  total,
  currency,
}: {
  parts: { label: string; amount: number; className: string }[];
  total: number;
  currency: string;
}) {
  const shown = parts.filter((p) => p.amount > 0);
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-border/60">
        {shown.map((p) => (
          <div key={p.label} className={p.className} style={{ width: `${total > 0 ? (p.amount / total) * 100 : 0}%` }} />
        ))}
      </div>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
        {shown.map((p) => (
          <div key={p.label} className="flex items-center gap-2 text-sm">
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", p.className)} />
            <span className="text-muted">{p.label}</span>
            <span className="num ml-auto font-semibold">{money(p.amount, currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- helpers ----------------------------------------------------------------

function irrTone(irr: number | null, hurdle: number): Tone {
  if (irr === null) return "stop";
  if (irr >= hurdle) return "go";
  if (irr >= 0) return "warn";
  return "stop";
}

const pctChange = (from: number, to: number) => (from > 0 ? Math.round(((to - from) / from) * 100) : 0);

const signed = (n: number) => `${n > 0 ? "+" : ""}${n}%`;
