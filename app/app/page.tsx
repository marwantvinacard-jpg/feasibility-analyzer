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

const TONE_CHIP: Record<Tone, string> = {
  go: "bg-go/12 text-go",
  warn: "bg-warn/12 text-warn",
  stop: "bg-stop/12 text-stop",
};

export default function Dashboard() {
  const { user } = useSession();
  const [items, setItems] = useState<AnalysisDoc[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeAnalyses(user.uid, setItems);
    return () => unsub();
  }, [user]);

  if (!user) return null;

  const greeting = dashboardGreeting(user.name.split(" ")[0], user.isFirstSession, items.length > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{greeting.headline}</h1>
          <p className="mt-1.5 text-sm text-muted">{greeting.subtitle}</p>
        </div>
        <Button href="/app/new"><Icon name="plus" size={18} /> New analysis</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Credits remaining" value={String(user.credits)} icon="spark" tone />
        <StatCard label="Reports run" value={String(items.filter((i) => i.status === "complete").length)} icon="doc" />
        <StatCard label="Key mode" value={user.keyMode === "byok" ? "Own key" : "Platform"} icon="sliders" />
      </div>

      <div>
        <h2 className="label mb-3">Your analyses</h2>
        {items.length === 0 ? (
          <div className="card grid place-items-center py-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand"><Icon name="doc" size={26} /></span>
            <h3 className="font-display mt-4 text-lg font-semibold">No analyses yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted">Describe a business idea and get a full eight-dimension feasibility report in minutes.</p>
            <Button href="/app/new" className="mt-5">Analyze your first idea <Icon name="arrow" size={17} /></Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <AnalysisRow key={a.id} a={a} onDelete={() => deleteAnalysis(a.id)} />
            ))}
          </div>
        )}
      </div>
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
        <Link href={`/app/analysis/${a.id}`} className="block truncate font-semibold hover:text-brand">{a.input.business_idea || "Untitled analysis"}</Link>
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
        <Link href={`/app/analysis/${a.id}`} className="btn btn-ghost px-3 text-xs" style={{ minHeight: 36 }}>Open</Link>
        <button onClick={onDelete} className="grid h-9 w-9 place-items-center rounded-lg text-faint hover:text-stop" aria-label="Delete analysis"><Icon name="x" size={16} /></button>
      </div>
    </div>
  );
}
