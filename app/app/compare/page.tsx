"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { subscribeAnalysis } from "@/lib/analyses";
import type { AnalysisDoc } from "@/lib/analysisTypes";
import type { CategoryScores } from "@/lib/engine/types";
import { DIMENSION_META, cn, money, scoreTone, toneStroke, toneText, verdictTone } from "@/lib/ui";
import { useT } from "@/lib/i18n/LanguageContext";

export default function ComparePage() {
  const params = useSearchParams();
  const router = useRouter();
  const t = useT();
  const ids = (params.get("ids") ?? "").split(",").filter(Boolean);
  const [docs, setDocs] = useState<Record<string, AnalysisDoc | null>>({});

  useEffect(() => {
    const unsubs = ids.map((id) => subscribeAnalysis(id, (doc) => setDocs((d) => ({ ...d, [id]: doc }))));
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  const items = ids.map((id) => docs[id]).filter((d): d is AnalysisDoc => !!d && d.status === "complete" && !!d.result);
  const loaded = ids.every((id) => id in docs);

  if (ids.length < 2) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <h2 className="font-display text-lg font-semibold">{t("compare.needTwo")}</h2>
        <Button href="/app" variant="ghost" className="mt-5">{t("nav.dashboard")}</Button>
      </div>
    );
  }

  const dims = Object.keys(DIMENSION_META) as (keyof CategoryScores)[];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("compare.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("compare.subtitle")}</p>
        </div>
        <button onClick={() => router.push("/app")} className="btn btn-ghost text-sm">
          <Icon name="arrow" size={16} className="rotate-180" /> {t("nav.dashboard")}
        </button>
      </div>

      {!loaded ? (
        <div className="py-20 text-center text-sm text-muted">{t("common.loading")}</div>
      ) : items.length < 2 ? (
        <div className="card py-16 text-center text-sm text-muted">{t("compare.notReady")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="w-40 pb-3 text-left text-xs font-semibold uppercase tracking-wide text-faint">{t("compare.metric")}</th>
                {items.map((a) => (
                  <th key={a.id} className="min-w-[220px] px-3 pb-3 text-left align-bottom">
                    <a href={`/app/analysis/${a.id}`} className="block truncate font-semibold hover:text-brand">
                      {a.input.business_idea || t("dashboard.untitled")}
                    </a>
                    <div className="mt-0.5 truncate text-xs text-faint">{a.input.location}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <CompareRow label={t("compare.verdict")}>
                {items.map((a) => {
                  const rec = a.result!.overall.recommendation;
                  return (
                    <td key={a.id} className="border-t border-border px-3 py-3">
                      <Badge tone={verdictTone(rec)}>{rec}</Badge>
                    </td>
                  );
                })}
              </CompareRow>
              <CompareRow label={t("compare.overallScore")}>
                {items.map((a) => {
                  const score = a.result!.overall.overall_score;
                  return (
                    <td key={a.id} className={cn("num border-t border-border px-3 py-3 text-xl font-semibold", toneText[scoreTone(score)])}>
                      {score}
                    </td>
                  );
                })}
              </CompareRow>
              {dims.map((k) => (
                <CompareRow key={k} label={t(`dim.${k}`)}>
                  {items.map((a) => {
                    const score = a.result!.categoryScores[k];
                    return (
                      <td key={a.id} className="border-t border-border px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="num text-sm font-semibold" style={{ color: toneStroke[scoreTone(score)] }}>{score}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(2, score)}%`, background: toneStroke[scoreTone(score)] }} />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </CompareRow>
              ))}
              <CompareRow label={t("compare.monthlyProfit")} muted>
                {items.map((a) => (
                  <td key={a.id} className="num border-t border-border px-3 py-3 text-sm">
                    {money(a.result!.financials.monthly_profit, a.input.currency)}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label={t("compare.margin")} muted>
                {items.map((a) => (
                  <td key={a.id} className="num border-t border-border px-3 py-3 text-sm">
                    {Math.round(a.result!.financials.profit_margin_percent)}%
                  </td>
                ))}
              </CompareRow>
              <CompareRow label={t("compare.breakEven")} muted>
                {items.map((a) => (
                  <td key={a.id} className="num border-t border-border px-3 py-3 text-sm">
                    {a.result!.financials.break_even_months === null
                      ? t("compare.never")
                      : t("compare.months", { n: Math.round(a.result!.financials.break_even_months) })}
                  </td>
                ))}
              </CompareRow>
              <CompareRow label={t("compare.capitalNeeded")} muted>
                {items.map((a) => (
                  <td key={a.id} className="num border-t border-border px-3 py-3 text-sm">
                    {money(a.result!.financials.startup_capital_needed, a.input.currency)}
                  </td>
                ))}
              </CompareRow>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompareRow({ label, children, muted }: { label: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <tr>
      <td className={cn("border-t border-border py-3 pr-3 text-sm font-medium", muted ? "text-muted" : "text-ink")}>{label}</td>
      {children}
    </tr>
  );
}
