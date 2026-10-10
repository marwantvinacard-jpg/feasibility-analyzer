import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { ContactLink, LegalSection, LegalShell } from "@/components/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Data Processing Agreement — FeasibilityAI" };

// Public, like /terms and /privacy: organizations often need to review a DPA
// before they sign up. The company details come from lib/legal.ts.
export default function DpaPage() {
  return (
    <LegalShell title="Data Processing Agreement">
      <p className="text-sm text-muted">
        For organizations that need a DPA in place before sending business data through {LEGAL.companyName}.
      </p>

      <div className="flex items-start gap-2.5 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
        <Icon name="risk" size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
        <span>
          This is a standard-form draft, not a countersigned agreement. Have counsel review it against your own
          jurisdiction&apos;s requirements (GDPR, CCPA, or otherwise) before relying on it — a template is a starting
          point, not a substitute for a lawyer&apos;s sign-off. Contact <ContactLink /> to execute a counter-signed copy.
        </span>
      </div>

      <LegalSection title="1. Roles">
        <p>
          The customer organization is the <strong className="text-ink">data controller</strong> for the personal data
          it submits (business-idea text, financial inputs, team member details). {LEGAL.companyName} is the{" "}
          <strong className="text-ink">data processor</strong>, processing that data solely to provide the
          feasibility-analysis service and only on the controller&apos;s documented instructions.
        </p>
      </LegalSection>

      <LegalSection title="2. Sub-processors">
        <p>
          The current sub-processor list is the one in the{" "}
          <Link href="/privacy" className="text-brand underline">Privacy Policy</Link> (&quot;Who processes it for
          us&quot;): Google Cloud / Firebase (hosting, sign-in, database and backups), the AI provider that runs the
          analysis, SerpAPI (web-search queries), Stripe (payments only), Resend (email), Sentry (error reports) and
          PostHog (analytics, only with consent).
        </p>
        <p>
          {LEGAL.companyName} will give reasonable notice before adding or replacing a sub-processor, and the
          controller may object on reasonable data-protection grounds.
        </p>
      </LegalSection>

      <LegalSection title="3. Security measures">
        <ul className="space-y-1.5">
          <li>• Encryption in transit (TLS) for all traffic; API keys are hashed at rest, never stored in plaintext, and saved AI provider keys are encrypted.</li>
          <li>• Access control via Firebase Authentication and server-enforced authorization on every data-access path.</li>
          <li>• Least-privilege service credentials; no client-side access to another customer&apos;s data by design.</li>
          <li>• Audit logging of administrative and billing actions.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Data subject rights & deletion">
        <p>
          {LEGAL.companyName} will assist the controller in responding to data subject access, correction, or erasure
          requests. Any account holder can self-serve an export or deletion of their own account data from Settings;
          org-wide requests should be sent to <ContactLink />.
        </p>
      </LegalSection>

      <LegalSection title="5. Breach notification">
        <p>
          {LEGAL.companyName} will notify the controller without undue delay upon becoming aware of a personal data
          breach affecting the controller&apos;s data, and will provide reasonably available information to help the
          controller meet its own notification obligations.
        </p>
      </LegalSection>

      <LegalSection title="6. International transfers">
        <p>
          Where a sub-processor stores or processes data outside the controller&apos;s jurisdiction, transfers rely on
          that sub-processor&apos;s own published safeguards (e.g. Google&apos;s and Stripe&apos;s Standard Contractual
          Clauses). Counsel should confirm this is sufficient for the controller&apos;s specific jurisdiction.
        </p>
      </LegalSection>

      <p className="text-center text-xs text-faint">
        Draft version — contact <ContactLink /> for an executable copy.
      </p>
    </LegalShell>
  );
}
