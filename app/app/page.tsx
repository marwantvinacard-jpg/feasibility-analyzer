"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Badge } from "@/components/kit";
import { Icon, type IconName } from "@/components/icons";
import { useSession } from "@/lib/session";
import { subscribeAnalyses, deleteAnalysis } from "@/lib/analyses";
import type { AnalysisDoc } from "@/lib/analysisTypes";
import { scoreTone, toneText, verdictTone, cn, type Tone } from "@/lib/ui";
import { dashboardGreeting } from "@/lib/greeting";
import { DashboardInsights } from "@/components/DashboardInsights";
import { useT } from "@/lib/i18n/LanguageContext";

type Filter = "all" | "complete" | "failed" | "running";
type Sort = "newest" | "oldest" | "score";

const TONE_CHIP: Record<Tone, string> = {
  go: "bg-go/12 text-go",
  warn: "bg-warn/12 text-warn",
  stop: "bg-stop/12 text-stop",
};

export default function Dashboard() {
  const { user } = useSession();
  const t = useT();
  const [items, setItems] = useState<AnalysisDoc[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeAnalyses(user.uid, setItems);
    return () => unsub();
  }, [user]);

  if (!user) return null;

  const greeting = dashboardGreeting(user.name.split(" ")[0], user.isFirstSession, items.length > 0, t);

  const completedScores = items
    .filter((a) => a.status === "complete" && a.result)
    .map((a) => a.result!.overall.overall_score);
  const avgScore = completedScores.length
    ? Math.round(completedScores.reduce((s, v) => s + v, 0) / completedScores.length)
    : null;

  const filtered = items.filter((a) => filter === "all" || a.status === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "oldest") return a.createdAt - b.createdAt;
    if (sort === "score") return (b.result?.overall.overall_score ?? -1) - (a.result?.overall.overall_score ?? -1);
    return b.createdAt - a.createdAt;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{greeting.headline}</h1>
          <p className="mt-1.5 text-sm text-muted">{greeting.subtitle}</p>
        </div>
        <Button href="/app/new"><Icon name="plus" size={18} /> {t("nav.newAnalysis")}</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label={t("dashboard.creditsRemaining")} value={String(user.credits)} icon="spark" tone />
        <StatCard label={t("dashboard.reportsRun")} value={String(items.filter((i) => i.status === "complete").length)} icon="doc" />
        <StatCard label={t("dashboard.avgScore")} value={avgScore === null ? "—" : String(avgScore)} icon="chart" />
        <StatCard label={t("dashboard.keyMode")} value={user.keyMode === "byok" ? t("dashboard.keyModeOwn") : t("dashboard.keyModePlatform")} icon="sliders" />
      </div>

      <DashboardInsights items={items} />

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="label">{t("dashboard.yourAnalyses")}</h2>
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <FilterTabs value={filter} onChange={setFilter} />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted focus:outline-none"
              >
                <option value="newest">{t("dashboard.sortNewest")}</option>
                <option value="oldest">{t("dashboard.sortOldest")}</option>
                <option value="score">{t("dashboard.sortScore")}</option>
              </select>
            </div>
          )}
        </div>
        {items.length === 0 ? (
          <div className="card grid place-items-center py-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand"><Icon name="doc" size={26} /></span>
            <h3 className="font-display mt-4 text-lg font-semibold">{t("dashboard.emptyTitle")}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted">{t("dashboard.emptyBody")}</p>
            <Button href="/app/new" className="mt-5">{t("dashboard.emptyCta")} <Icon name="arrow" size={17} /></Button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="card grid place-items-center py-12 text-center text-sm text-muted">
            {t("dashboard.noMatch")}
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((a) => (
              <AnalysisRow key={a.id} a={a} onDelete={() => deleteAnalysis(a.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterTabs({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  const t = useT();
  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: t("dashboard.filterAll") },
    { key: "complete", label: t("dashboard.filterComplete") },
    { key: "running", label: t("dashboard.filterRunning") },
    { key: "failed", label: t("dashboard.filterFailed") },
  ];
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
            value === f.key ? "bg-brand text-white" : "text-muted hover:text-ink"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: string; icon: IconName; tone?: boolean }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className={cn("grid h-11 w-11 place-items-center rounded-xl", tone ? "bg-brand/10 text-brand" : "bg-surface-2 text-muted")}>
        <Icon name={icon} size={20} />
      </span>
      <div>
        <div className="label">{label}</div>
        <div className={cn("num mt-0.5 text-xl font-semibold", tone && "text-brand")}>{value}</div>
      </div>
    </div>
  );
}

function AnalysisRow({ a, onDelete }: { a: AnalysisDoc; onDelete: () => void }) {
  const t = useT();
  const score = a.result?.overall.overall_score;
  const rec = a.result?.overall.recommendation;
  const tone = rec ? verdictTone(rec) : "warn";
  const statusIcon: IconName = a.status === "complete" ? "check" : a.status === "failed" ? "x" : "clock";

  return (
    <div className="card flex items-center gap-4 p-4">
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", a.status === "complete" ? TONE_CHIP[tone] : a.status === "failed" ? "bg-stop/12 text-stop" : "bg-surface-2 text-faint")}>
        <Icon name={statusIcon} size={19} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <Link href={`/app/analysis/${a.id}`} className="block truncate font-semibold hover:text-brand">{a.input.business_idea || t("dashboard.untitled")}</Link>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-faint">
          <span className="truncate">{a.input.location}</span>
          <span>·</span>
          <span>{new Date(a.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      {a.status === "complete" && score !== undefined ? (
        <div className="hidden items-center gap-3 sm:flex">
          <Badge tone={tone}>{rec}</Badge>
          <div className={cn("num text-xl font-semibold", toneText[scoreTone(score)])}>{score}</div>
        </div>
      ) : (
        <Badge>{a.status}</Badge>
      )}
      <div className="flex items-center gap-1">
        <Link href={`/app/analysis/${a.id}`} className="btn btn-ghost px-3 text-xs" style={{ minHeight: 36 }}>{t("common.open")}</Link>
        <button onClick={onDelete} className="grid h-9 w-9 place-items-center rounded-lg text-faint hover:text-stop" aria-label="Delete analysis"><Icon name="x" size={16} /></button>
      </div>
    </div>
  );
}
