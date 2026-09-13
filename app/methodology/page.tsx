import Link from "next/link";
import { Mark } from "@/components/Brand";
import { Button } from "@/components/kit";
import { Icon } from "@/components/icons";
import { DIMENSION_META } from "@/lib/ui";
import { WEIGHTS } from "@/lib/engine/scorer";

export const metadata = { title: "Methodology — FeasibilityAI" };

const BANDS = [
  { range: "80–100", label: "HIGHLY FEASIBLE", verdict: "GO", tone: "text-go" },
  { range: "60–79", label: "FEASIBLE", verdict: "GO, with conditions", tone: "text-go" },
  { range: "40–59", label: "MARGINAL", verdict: "CONDITIONAL — major improvements needed", tone: "text-warn" },
  { range: "0–39", label: "NOT FEASIBLE", verdict: "NO-GO", tone: "text-stop" },
];

export default function MethodologyPage() {
  const dims = Object.entries(DIMENSION_META) as [keyof typeof WEIGHTS, (typeof DIMENSION_META)[keyof typeof DIMENSION_META]][];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Mark className="h-7 w-7" /> FeasibilityAI
          </Link>
          <Button href="/sample-report" variant="ghost" className="text-sm">See a sample report</Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-8 px-5 py-12 sm:px-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">How the score is actually computed</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Not a black box. Every figure below is checked by an automated test suite against these exact values — this page
            describes real, running code, not marketing copy about the code.
          </p>
        </div>

        <section className="card space-y-3 p-6">
          <h2 className="font-display text-lg font-semibold">The financial math never touches the AI</h2>
          <p className="text-sm leading-relaxed text-muted">
            Profit, margin, break-even, NPV, IRR, and capital requirements are computed by deterministic code —
            the same arithmetic every time for the same inputs. The AI specialists (market, technical, competitive,
            location, operational, legal, risk) only ever produce <em>judgment</em>: written analysis and a 0–100 score
            for their dimension. They never touch the numbers.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold mb-4">The eight dimensions, weighted</h2>
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 text-left text-xs uppercase tracking-wide text-faint">
                  <th className="px-4 py-2.5 font-semibold">Dimension</th>
                  <th className="px-4 py-2.5 font-semibold">What it judges</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Weight</th>
                </tr>
              </thead>
              <tbody>
                {dims
                  .sort((a, b) => WEIGHTS[b[0]] - WEIGHTS[a[0]])
                  .map(([key, meta]) => (
                    <tr key={key} className="border-t border-border">
                      <td className="flex items-center gap-2.5 px-4 py-3 font-medium">
                        <Icon name={meta.icon} size={16} className="text-brand" /> {meta.label}
                      </td>
                      <td className="px-4 py-3 text-muted">{meta.blurb}</td>
                      <td className="num px-4 py-3 text-right font-semibold">{Math.round(WEIGHTS[key] * 100)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-faint">Weights sum to exactly 100% — checked by an automated test on every deploy.</p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold mb-4">Score bands and verdicts</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {BANDS.map((b) => (
              <div key={b.range} className="card p-4">
                <div className="flex items-baseline justify-between">
                  <span className="num text-lg font-semibold">{b.range}</span>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${b.tone}`}>{b.label}</span>
                </div>
                <div className="mt-1 text-sm text-muted">{b.verdict}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card space-y-3 p-6">
          <h2 className="font-display text-lg font-semibold">What this is not</h2>
          <p className="text-sm leading-relaxed text-muted">
            This is a decision-support analysis, not a certified appraisal, audit, or investment recommendation.
            The arithmetic is exact given the inputs; the inputs themselves — market size, pricing, cost structure —
            are estimates, whether you supplied them or the AI specialists inferred them from public information.
            You remain responsible for independently verifying anything decision-critical. See the full
            <Link href="/app/legal" className="text-brand underline"> methodology &amp; liability disclaimer</Link> for details.
          </p>
        </section>

        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <h2 className="font-display text-xl font-semibold">See it applied to a real example</h2>
          <div className="flex flex-wrap justify-center gap-3">
            <Button href="/sample-report">View sample report <Icon name="arrow" size={17} /></Button>
            <Button href="/signup" variant="ghost">Analyze my own idea</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
