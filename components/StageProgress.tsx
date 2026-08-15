"use client";

import { DIMENSION_META, cn } from "@/lib/ui";
import type { StageName, StageStatus } from "@/lib/engine/types";

const ORDER: StageName[] = ["market", "financial", "technical", "competitive", "location", "risk"];

export function StageProgress({ status }: { status: Record<StageName, StageStatus> }) {
  const done = ORDER.filter((s) => status[s] === "done").length;
  const pct = Math.round((done / ORDER.length) * 100);

  return (
    <div className="card mx-auto max-w-xl p-6">
      <div className="text-center">
        <div className="text-4xl">🧠</div>
        <h2 className="mt-3 text-xl font-bold">Analyzing your idea…</h2>
        <p className="mt-1 text-sm text-muted">Six specialists are researching in parallel. This takes a moment.</p>
      </div>

      <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-border/60">
        <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${Math.max(6, pct)}%` }} />
      </div>

      <div className="mt-5 space-y-2">
        {ORDER.map((s) => {
          const st = status[s];
          return (
            <div key={s} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
              <StageIcon status={st} />
              <div className="flex-1">
                <div className="text-sm font-medium">{DIMENSION_META[s].label}</div>
                <div className="text-xs text-faint">{DIMENSION_META[s].blurb}</div>
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  st === "done" ? "text-go" : st === "running" ? "text-brand" : st === "failed" ? "text-stop" : "text-faint"
                )}
              >
                {st === "done" ? "Done" : st === "running" ? "Researching…" : st === "failed" ? "Failed" : "Queued"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "done")
    return <span className="grid h-6 w-6 place-items-center rounded-full bg-go/15 text-xs text-go">✓</span>;
  if (status === "failed")
    return <span className="grid h-6 w-6 place-items-center rounded-full bg-stop/15 text-xs text-stop">✕</span>;
  if (status === "running")
    return (
      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/15">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </span>
    );
  return <span className="grid h-6 w-6 place-items-center rounded-full bg-border/60 text-xs text-faint">○</span>;
}
