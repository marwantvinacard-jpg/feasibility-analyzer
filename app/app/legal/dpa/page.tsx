"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";

const LEGAL_ENTITY = "Aibots Automations";
const CONTACT_EMAIL = "marwan.tvinacard@gmail.com";

export default function DpaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/app/legal" className="text-sm text-muted hover:text-brand">&larr; Back to Legal</Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">Data Processing Agreement</h1>
        <p className="mt-1.5 text-sm text-muted">For organizations that need a DPA in place before sending business data through {LEGAL_ENTITY}.</p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
        <Icon name="risk" size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
        <span>
          This is a standard-form draft, not a countersigned agreement. Have counsel review it against your own
          jurisdiction's requirements (GDPR, CCPA, or otherwise) before relying on it — a template is a starting
          point, not a substitute for a lawyer's sign-off. Contact <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a> to
          execute a counter-signed copy.
        </span>
      </div>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">1. Roles</h2>
        <p className="text-sm leading-relaxed text-muted">
          The customer organization is the <strong className="text-ink">data controller</strong> for the personal
          data it submits (business-idea text, financial inputs, team member details). {LEGAL_ENTITY} is the
          <strong className="text-ink"> data processor</strong>, processing that data solely to provide the
          feasibility-analysis service and only on the controller's documented instructions.
        </p>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">2. Sub-processors</h2>
        <p className="text-sm leading-relaxed text-muted">The current sub-processor list matches the Privacy Policy:</p>
        <ul className="space-y-1.5 text-sm leading-relaxed text-muted">
          <li>• Google Firebase — authentication and database hosting.</li>
          <li>• Google Gemini API — receives submitted business/financial inputs to generate analyses.</li>
          <li>• SerpAPI — receives derived search queries when live web research is enabled.</li>
          <li>• Stripe — receives billing details for payments only.</li>
          <li>• Vercel — hosts the application and its request logs.</li>
        </ul>
        <p className="text-sm leading-relaxed text-muted">
          {LEGAL_ENTITY} will give reasonable notice before adding or replacing a sub-processor, and the controller
          may object on reasonable data-protection grounds.
        </p>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">3. Security measures</h2>
        <ul className="space-y-1.5 text-sm leading-relaxed text-muted">
          <li>• Encryption in transit (TLS) for all traffic; API keys are hashed at rest, never stored in plaintext.</li>
          <li>• Access control via Firebase Authentication and server-enforced authorization on every data-access path.</li>
          <li>• Least-privilege service credentials; no client-side access to another customer's data by design.</li>
          <li>• Audit logging of administrative and billing actions.</li>
        </ul>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">4. Data subject rights & deletion</h2>
        <p className="text-sm leading-relaxed text-muted">
          {LEGAL_ENTITY} will assist the controller in responding to data subject access, correction, or erasure
          requests. Any account holder can self-serve an export or deletion of their own account data from
          Settings; org-wide requests should be sent to <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">5. Breach notification</h2>
        <p className="text-sm leading-relaxed text-muted">
          {LEGAL_ENTITY} will notify the controller without undue delay upon becoming aware of a personal data
          breach affecting the controller's data, and will provide reasonably available information to help the
          controller meet its own notification obligations.
        </p>
      </section>

      <section className="card space-y-3 p-6">
        <h2 className="font-display text-lg font-semibold">6. International transfers</h2>
        <p className="text-sm leading-relaxed text-muted">
          Where a sub-processor above stores or processes data outside the controller's jurisdiction, transfers rely
          on that sub-processor's own published safeguards (e.g. Google's and Stripe's Standard Contractual
          Clauses). Counsel should confirm this is sufficient for the controller's specific jurisdiction.
        </p>
      </section>

      <p className="text-center text-xs text-faint">
        Draft version — contact <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand underline">{CONTACT_EMAIL}</a> for an executable copy.
      </p>
    </div>
  );
}
