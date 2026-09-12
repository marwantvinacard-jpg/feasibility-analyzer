"use client";

import { Icon } from "@/components/icons";

// Fill these in with your real legal entity before launch — everything below
// is written to be accurate SaaS boilerplate, but a contract needs a real
// counterparty and a real forum, which nobody but you can supply.
const LEGAL_ENTITY = "[Legal entity name — e.g. FeasibilityAI, Inc.]";
const GOVERNING_LAW = "[Governing law / jurisdiction — e.g. the State of Delaware, USA]";
const CONTACT_EMAIL = "legal@feasibility.local";

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Legal</h1>
        <p className="mt-1.5 text-sm text-muted">Terms of service, privacy policy, and the methodology / liability disclaimer.</p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
        <Icon name="risk" size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
        <span>
          Two placeholders below (<strong>{LEGAL_ENTITY}</strong> and <strong>{GOVERNING_LAW}</strong>) need your real
          incorporated entity and chosen jurisdiction — that's business information nobody but you can supply. Once
          filled in, have counsel give this a final pass before scaling internationally, especially the
          jurisdiction-specific licensing question called out in the methodology disclaimer.
        </span>
      </div>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">Methodology & liability disclaimer</h2>
        <p className="text-sm leading-relaxed text-muted">
          FeasibilityAI produces a decision-support analysis, not a certified appraisal, audit, or investment
          recommendation, and is not a substitute for advice from a licensed professional in any jurisdiction where
          producing a "feasibility study" is a regulated activity. Every dollar figure in the financial study is
          computed deterministically from the inputs and assumptions supplied or modeled — the arithmetic is exact,
          but the assumptions themselves (market size, pricing, cost structure, growth rates) are estimates, whether
          stated by the user or inferred by the AI specialists from public information. Users and their clients
          remain solely responsible for independently verifying material assumptions before relying on this
          analysis for a financing, investment, or go/no-go decision.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Qualitative findings (market, competitive, legal, risk, and related narrative sections) are produced by AI
          research agents and are provided "as is," without warranty of accuracy or completeness. Cited sources
          should be checked directly for anything decision-critical. Nothing on this platform constitutes legal,
          accounting, tax, or licensed financial advisory services. Organizations that share generated reports with
          their own clients are responsible for passing this disclaimer along with the report and for confirming, in
          their own jurisdiction, whether presenting AI-generated analysis under a licensed term (e.g. "feasibility
          study," "appraisal") requires additional disclosure.
        </p>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">Privacy policy</h2>
        <h3 className="text-sm font-semibold text-ink">What we collect</h3>
        <p className="text-sm leading-relaxed text-muted">
          Account email and name; organization membership and role; the business-idea text and financial inputs you
          submit for analysis; the resulting reports; hashed (never plaintext) API keys you issue; and standard
          server error logs. If you pay us, Stripe collects your payment details directly — we never see or store
          card numbers.
        </p>
        <h3 className="text-sm font-semibold text-ink">Who we share it with</h3>
        <p className="text-sm leading-relaxed text-muted">
          We use a small set of sub-processors to run the service, and share only what each one needs to do its job:
        </p>
        <ul className="space-y-1.5 text-sm leading-relaxed text-muted">
          <li>• <strong className="text-ink">Google Firebase</strong> — authentication and database hosting for all account and analysis data.</li>
          <li>• <strong className="text-ink">Google Gemini API</strong> — receives the business idea and financial inputs you submit, to generate your analysis.</li>
          <li>• <strong className="text-ink">SerpAPI</strong> — receives search queries derived from your business idea, when live web research is enabled.</li>
          <li>• <strong className="text-ink">Stripe</strong> — receives billing details for payments; never receives your analysis content.</li>
          <li>• <strong className="text-ink">Vercel</strong> — hosts the application and its request logs.</li>
        </ul>
        <p className="text-sm leading-relaxed text-muted">
          We do not sell your data. If you enter a client's confidential information into a study, you are
          representing that you have the right to share it with the sub-processors above for the purpose of
          generating that study.
        </p>
        <h3 className="text-sm font-semibold text-ink">Model training</h3>
        <p className="text-sm leading-relaxed text-muted">
          By default, de-identified prompts and outputs from your analyses may be used to improve FeasibilityAI's own
          models. You can turn this off at any time in <strong className="text-ink">Settings → Model training</strong> —
          opting out excludes all future analyses on your account from training data collection immediately.
        </p>
        <h3 className="text-sm font-semibold text-ink">Your rights</h3>
        <p className="text-sm leading-relaxed text-muted">
          You can request a copy of your account's data, or request deletion of your account and associated
          analyses, by contacting <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline">{CONTACT_EMAIL}</a>.
          We retain analysis records for as long as your account is active, plus a reasonable period afterward for
          legal and accounting purposes.
        </p>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">Intellectual property</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-muted">
          <li>• You (or your organization) own the specific report generated for you, and may present it to your own clients, including under your own branding.</li>
          <li>• We retain all rights to the FeasibilityAI software, scoring methodology, and prompts — nothing above grants you a license to the underlying platform.</li>
          <li>• De-identified, aggregated insights derived from analyses (e.g. benchmark statistics) may be used and shared by us; this never includes your raw business-idea text or client-identifying detail.</li>
        </ul>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">Billing, refunds & cancellation</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-muted">
          <li>• Subscriptions (individual Pro, and organization Starter/Growth/Enterprise plans) renew monthly and can be cancelled at any time, effective at the end of the current billing period — no partial-month refunds.</li>
          <li>• Wallet top-ups and credits are non-refundable once purchased, but unused credits never expire.</li>
          <li>• The one-time $3,000 per-study export unlock is non-refundable once the PDF has been generated, since the underlying analysis was already delivered in full for free viewing before purchase.</li>
          <li>• If a charge failed to deliver the service paid for (e.g. a failed export, a billing error), contact <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline">{CONTACT_EMAIL}</a> for a refund of that specific charge.</li>
        </ul>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">Terms of service (summary)</h2>
        <ul className="space-y-2 text-sm leading-relaxed text-muted">
          <li>• Your account and organization's data belong to you; we don't sell it — see the Privacy policy above for exactly who we share it with and why.</li>
          <li>• API access is billed per credit consumed, same rate as the web app, drawn from the organization owner's balance.</li>
          <li>• Organization owners are responsible for who they invite and what API keys they issue — revoke access promptly when a teammate or integration no longer needs it.</li>
          <li>• Service is provided without uptime guarantees at this stage; an SLA is available on request for Growth and Enterprise plan customers.</li>
          <li>• This agreement is between you and {LEGAL_ENTITY}, and is governed by the laws of {GOVERNING_LAW}, without regard to conflict-of-law principles.</li>
        </ul>
      </section>

      <p className="text-center text-xs text-faint">
        Questions about these terms — contact <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline">{CONTACT_EMAIL}</a>.
      </p>
    </div>
  );
}
