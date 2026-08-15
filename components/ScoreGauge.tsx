import { scoreTone, toneStroke, toneText, cn } from "@/lib/ui";

/** Circular score gauge (0-100) colored by tone. Pure SVG, theme-aware. */
export function ScoreGauge({
  score,
  size = 168,
  label,
  sublabel,
}: {
  score: number;
  size?: number;
  label?: string;
  sublabel?: string;
}) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const tone = scoreTone(score);

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--border))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneStroke[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute grid place-items-center text-center">
        <div className={cn("text-4xl font-bold tabular-nums", toneText[tone])}>{score}</div>
        <div className="text-xs font-medium text-faint">{label ?? "/ 100"}</div>
        {sublabel && <div className="mt-0.5 text-[0.7rem] text-muted">{sublabel}</div>}
      </div>
    </div>
  );
}

/** Compact horizontal score bar. */
export function ScoreBar({ score }: { score: number }) {
  const tone = scoreTone(score);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-border/60">
      <div
        className={cn("h-full rounded-full", tone === "go" ? "bg-go" : tone === "warn" ? "bg-warn" : "bg-stop")}
        style={{ width: `${Math.max(3, Math.min(100, score))}%`, transition: "width 700ms cubic-bezier(0.22,1,0.36,1)" }}
      />
    </div>
  );
}
