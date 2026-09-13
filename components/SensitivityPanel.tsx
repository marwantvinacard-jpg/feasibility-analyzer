"use client";

// Automatic sensitivity preview — no manual stress-test session required.
// Recomputes the same deterministic financial math under a standard ±15%
// swing on revenue and cost, so a reader sees "what would need to be true"
// at a glance instead of trusting the single base-case number blind.
// Purely computed client-side from the input already in the report; the
// full interactive Stress Test page (with custom knobs) is still there for
// deeper what-if exploration.

import { computeFinancials } from "@/lib/engine/financial";
import { money, scoreTone, toneStroke } from "@/lib/ui";
import type { BusinessInput } from "@/lib/engine/types";
import { useT } from "@/lib/i18n/LanguageContext";

const SWING = 0.15;

export function SensitivityPanel({ input, analysisId }: { input: BusinessInput; analysisId?: string }) {
  const t = useT();
  const cur = input.currency ?? "USD";
  const revenue = Number(input.monthly_revenue) || 0;
  const cost = Number(input.monthly_cost) || 0;

  const scenarios = [
    {
      key: "pessimistic",
      label: t("sensitivity.pessimistic"),
      detail: t("sensitivity.pessimisticDetail", { pct: Math.round(SWING * 100) }),
      calc: computeFinancials({ ...input, monthly_revenue: revenue * (1 - SWING), monthly_cost: cost * (1 + SWING) }),
    },
    {
      key: "base",
      label: t("sensitivity.base"),
      detail: t("sensitivity.baseDetail"),
      calc: computeFinancials(input),
    },
    {
      key: "optimistic",
      label: t("sensitivity.optimistic"),
      detail: t("sensitivity.optimisticDetail", { pct: Math.round(SWING * 100) }),
      calc: computeFinancials({ ...input, monthly_revenue: revenue * (1 + SWING), monthly_cost: cost * (1 - SWING) }),
    },
  ];

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">{t("sensitivity.title")}</h3>
        <span className="text-xs text-faint">{t("sensitivity.subtitle", { pct: Math.round(SWING * 100) })}</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-faint">
              <th className="pb-2 pr-3 font-semibold">{t("sensitivity.scenario")}</th>
              <th className="pb-2 px-3 font-semibold">{t("sensitivity.monthlyProfit")}</th>
              <th className="pb-2 px-3 font-semibold">{t("sensitivity.margin")}</th>
              <th className="pb-2 pl-3 font-semibold">{t("sensitivity.breakEven")}</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => {
              const profitTone = s.calc.monthly_profit >= 0 ? "go" : "stop";
              return (
                <tr key={s.key} className="border-t border-border">
                  <td className="py-3 pr-3">
                    <div className="font-medium">{s.label}</div>
                    <div className="text-xs text-faint">{s.detail}</div>
                  </td>
                  <td className="num px-3 py-3 font-semibold" style={{ color: toneStroke[profitTone] }}>
                    {money(s.calc.monthly_profit, cur)}
                  </td>
                  <td className="num px-3 py-3">{s.calc.profit_margin_percent}%</td>
                  <td className="num py-3 pl-3">
                    {s.calc.break_even_months === null ? t("sensitivity.never") : t("sensitivity.months", { n: s.calc.break_even_months })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {analysisId && (
        <a href={`/app/analysis/${analysisId}/stress`} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
          {t("sensitivity.fullStressTest")} →
        </a>
      )}
    </div>
  );
}
