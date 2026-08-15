"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Badge } from "@/components/kit";
import { useSession } from "@/lib/session";
import { listAnalyses, deleteAnalysis, type AnalysisRecord } from "@/lib/store";
import { scoreTone, toneText, verdictTone, cn } from "@/lib/ui";

export default function Dashboard() {
  const { user } = useSession();
  const [items, setItems] = useState<AnalysisRecord[]>([]);

  useEffect(() => {
    if (user) setItems(listAnalyses(user.uid));
  }, [user]);

  if (!user) return null;

  function remove(id: string) {
    deleteAnalysis(id);
    setItems(listAnalyses(user!.uid));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted">Run a new feasibility analysis or revisit a past report.</p>
        </div>
        <Button href="/app/new">＋ New analysis</Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Credits remaining" value={String(user.credits)} tone="brand" />
        <StatCard label="Reports run" value={String(items.filter((i) => i.status === "complete").length)} />
        <StatCard label="Key mode" value={user.keyMode === "byok" ? "Your own key" : "Platform"} />
      </div>

      {/* History */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">Your analyses</h2>
        {items.length === 0 ? (
          <div className="card grid place-items-center py-16 text-center">
            <div className="text-4xl">📊</div>
            <h3 className="mt-3 text-lg font-semibold">No analyses yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Describe a business idea and get a full six-dimension feasibility report in minutes.
            </p>
            <Button href="/app/new" className="mt-5">Analyze your first idea →</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <AnalysisRow key={a.id} a={a} onDelete={() => remove(a.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "brand" }) {
  return (
    <div className="card p-5">
      <div className="text-xs text-faint">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold", tone === "brand" && "text-brand")}>{value}</div>
    </div>
  );
}

function AnalysisRow({ a, onDelete }: { a: AnalysisRecord; onDelete: () => void }) {
  const score = a.result?.overall.overall_score;
  const rec = a.result?.overall.recommendation;
  const tone = rec ? verdictTone(rec) : "warn";

  return (
    <div className="card flex items-center gap-4 p-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg">
        {a.status === "complete" ? a.result?.overall.emoji ?? "📄" : a.status === "failed" ? "⚠️" : "⏳"}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/app/analysis/${a.id}`} className="truncate font-semibold hover:text-brand">
          {a.input.business_idea || "Untitled analysis"}
        </Link>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-faint">
          <span>{a.input.location}</span>
          <span>·</span>
          <span>{new Date(a.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      {a.status === "complete" && score !== undefined ? (
        <div className="flex items-center gap-3">
          <Badge tone={tone}>{rec}</Badge>
          <div className={cn("text-xl font-bold tabular-nums", toneText[scoreTone(score)])}>{score}</div>
        </div>
      ) : (
        <Badge>{a.status}</Badge>
      )}
      <div className="flex items-center gap-1">
        <Link href={`/app/analysis/${a.id}`} className="btn btn-ghost px-3 py-1.5 text-xs">Open</Link>
        <button onClick={onDelete} className="px-2 text-faint hover:text-stop" title="Delete">✕</button>
      </div>
    </div>
  );
}
