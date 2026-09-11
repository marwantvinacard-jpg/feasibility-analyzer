"use client";

import { Icon } from "@/components/icons";

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Legal</h1>
        <p className="mt-1.5 text-sm text-muted">Terms of service and the methodology / liability disclaimer.</p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
        <Icon name="risk" size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
        <span>
          <strong>Draft — not reviewed by a lawyer.</strong> This is placeholder legal language to unblock building
          the rest of the app. Before onboarding a paying feasibility firm (and definitely before their clients see
          your name on a study), have this reviewed by counsel — especially the liability and IP-ownership sections,
          and check whether "financial feasibility study" output needs any local licensing disclaimer in the
          jurisdictions you plan to sell into.
        </span>
      </div>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">Methodology & liability disclaimer</h2>
        <p className="text-sm leading-relaxed text-muted">
          FeasibilityAI produces a decision-support analysis, not a certified appraisal, audit, or investment
          recommendation. Every dollar figure in the financial study is computed deterministically from the inputs
          and assumptions supplied or modeled — the arithmetic is exact, but the assumptions themselves (market
          size, pricing, cost structure, growth rates) are estimates, whether stated by the user or inferred by the
          AI specialists from public information. Users and their clients remain responsible for independently
          verifying material assumptions before relying on this analysis for a financing, investment, or
          go/no-go decision.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Qualitative findings (market, competitive, legal, risk, and related narrative sections) are produced by AI
          research agents and are provided "as is," without warranty of accuracy or completeness. Cited sources
          should be checked directly for anything decision-critical. Nothing on this platform constitutes legal,
          accounting, tax, or licensed financial advisory services.
        </p>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">Terms of service (summary)</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-muted">
          <li>• Your account and organization's data belong to you; we don't sell it or use it to train third-party models outside what's disclosed in your data-processing agreement.</li>
          <li>• Analyses your organization runs may be used, in de-identified form, to improve the platform's own models — see the Training Data note in Settings for how to opt out.</li>
          <li>• API access is billed per credit consumed, same rate as the web app, drawn from the organization owner's balance.</li>
          <li>• Organization owners are responsible for who they invite and what API keys they issue — revoke access promptly when a teammate or integration no longer needs it.</li>
          <li>• Service is provided without uptime guarantees at this stage; an SLA is available on request for Team-plan customers.</li>
        </ul>
      </section>

      <p className="text-center text-xs text-faint">
        Questions about these terms — contact the account owner. This page will be replaced with reviewed,
        jurisdiction-specific terms before general availability.
      </p>
    </div>
  );
}
