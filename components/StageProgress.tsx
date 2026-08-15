"use client";

import { DIMENSION_META, cn } from "@/lib/ui";
import { Icon } from "@/components/icons";
import type { StageName, StageStatus } from "@/lib/engine/types";

const ORDER: StageName[] = ["market", "financial", "technical", "competitive", "location", "risk"];

export function StageProgress({ status }: { status: Record<StageName, StageStatus> }) {
  const done = ORDER.filter((s) => status[s] === "done").length;
  const pct = Math.round((done / ORDER.length) * 100);

  return (
    <div className="card mx-auto max-w-xl p-7">
      <div className="text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand">
          <Icon name="spark" size={24} />
        </span>
        <h2 className="font-display mt-4 text-2xl font-semibold tracking-tight">Analyzing your idea</h2>
        <p className="mt-1.5 text-sm text-muted">
          Six specialists are researching in parallel — this takes a moment.
        </p>
        <div className="num mt-1 text-xs text-faint">{pct}% complete</div>
      </div>

      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${Math.max(6, pct)}%` }} />
      </div>

      <div className="mt-5 space-y-2">
        {ORDER.map((s) => {
          const st = status[s];
          return (
            <div
              key={s}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                st === "done" ? "border-go/30 bg-go/5" : st === "running" ? "border-brand/30 bg-brand/5" : "border-border bg-surface-2"
              )}
            >
              <StageIcon stage={s} status={st} />
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
                {st === "done" ? "Done" : st === "running" ? "Researching" : st === "failed" ? "Failed" : "Queued"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StageIcon({ stage, status }: { stage: StageName; status: StageStatus }) {
  if (status === "done")
    return (
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-go/15 text-go">
        <Icon name="check" size={16} strokeWidth={2.25} />
      </span>
    );
  if (status === "failed")
    return (
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-stop/15 text-stop">
        <Icon name="x" size={16} strokeWidth={2.25} />
      </span>
    );
  if (status === "running")
    return (
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/15 text-brand">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </span>
    );
  return (
    <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface text-faint">
      <Icon name={DIMENSION_META[stage].icon} size={15} />
    </span>
  );
}
