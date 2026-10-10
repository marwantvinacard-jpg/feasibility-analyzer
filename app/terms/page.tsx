import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink, LegalSection, LegalShell } from "@/components/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service · FeasibilityAI" };

// Public page — readable before signing up (it used to sit behind the login).
export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <LegalSection title="Agreement">
        <p>
          These terms are an agreement between you and <strong className="text-ink">{LEGAL.companyName}</strong>,{" "}
          {LEGAL.address}. By creating an account or using FeasibilityAI you accept them and our{" "}
          <Link href="/privacy" className="text-brand underline">Privacy Policy</Link>. They are governed by the laws of{" "}
          {LEGAL.governingLaw}, without regard to conflict-of-law principles.
        </p>
      </LegalSection>

      <LegalSection title="Methodology & liability disclaimer">
        <p>
          FeasibilityAI produces a decision-support analysis, not a certified appraisal, audit, or investment
          recommendation, and is not a substitute for advice from a licensed professional in any jurisdiction where
          producing a &quot;feasibility study&quot; is a regulated activity. Figures in the financial study are computed
          exactly from the inputs and assumptions supplied or modeled, but those assumptions (market size, pricing, costs,
          growth) are estimates, whether stated by you or inferred by AI from public information. You remain responsible
          for independently verifying material assumptions before relying on an analysis for a financing, investment or
          go/no-go decision.
        </p>
        <p>
          Qualitative findings are produced by AI and provided &quot;as is&quot;, without warranty of accuracy or
          completeness; reports say when live web research was unavailable or a section could not be analysed. Check
          cited sources directly for anything decision-critical. Nothing on this platform is legal, accounting, tax or
          licensed financial advice. Organizations that share reports with their clients must pass this disclaimer on.
        </p>
      </LegalSection>

      <LegalSection title="Accounts and organizations">
        <ul className="space-y-1.5">
          <li>• Keep your sign-in details secure; you are responsible for activity on your account.</li>
          <li>• Organization owners are responsible for who they invite and which API keys they issue. Joining an organization shares your analyses with its members — you&apos;ll always be asked to accept an invitation first.</li>
          <li>• We may suspend accounts that abuse the service, attempt to bypass limits or payments, or break the law.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Your content and our platform">
        <ul className="space-y-1.5">
          <li>• You (or your organization) own the reports generated for you and may present them to your own clients, including under your own branding.</li>
          <li>• We retain all rights to the FeasibilityAI software, scoring methodology and prompts.</li>
          <li>• Aggregated, de-identified statistics (e.g. benchmark averages) may be used by us; they never include your business-idea text or client-identifying detail.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Billing, credits and refunds">
        <ul className="space-y-1.5">
          <li>• Each analysis uses one credit, except analyses run on your own AI key. A failed or interrupted analysis is refunded automatically.</li>
          <li>• Subscriptions renew monthly and can be cancelled any time, effective at the end of the current billing period — no partial-month refunds.</li>
          <li>• An organization plan&apos;s free trial includes a trial allowance of credits; the full monthly credits start with the first payment.</li>
          <li>• Purchased credits are non-refundable but never expire.</li>
          <li>• The one-time per-study export unlock is non-refundable once the PDF has been generated.</li>
          <li>• If a charge failed to deliver what was paid for, contact <ContactLink /> for a refund of that charge.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Service">
        <p>
          The service is provided without uptime guarantees at this stage; an SLA is available on request for Growth and
          Enterprise plans. We may change these terms; material changes will be announced in the app, and continuing to
          use the service after that means you accept them. Questions: <ContactLink />.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
