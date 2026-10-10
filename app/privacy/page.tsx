import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink, LegalSection, LegalShell } from "@/components/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy · FeasibilityAI" };

// Public page — readable before signing up. Keep it in step with what the code
// actually does; it was previously wrong about hosting, training and deletion.
export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <LegalSection title="Who we are">
        <p>
          FeasibilityAI is operated by <strong className="text-ink">{LEGAL.companyName}</strong>, {LEGAL.address} (&quot;we&quot;).
          For any privacy question or request, contact <ContactLink />.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <ul className="space-y-1.5">
          <li>• <strong className="text-ink">Account:</strong> email, name, username, sign-in method, account status and credit balance.</li>
          <li>• <strong className="text-ink">Your analyses:</strong> the business details, financial figures and documents you submit, and the reports we generate from them.</li>
          <li>• <strong className="text-ink">Organizations:</strong> membership, role and invitations; API key metadata (keys themselves are stored only as hashes).</li>
          <li>• <strong className="text-ink">Your own AI key</strong> (if you use &quot;bring your own key&quot;): stored encrypted; we show only its last 4 characters.</li>
          <li>• <strong className="text-ink">Billing:</strong> payment records (amounts, dates, plan). Card details go directly to Stripe — we never see them.</li>
          <li>• <strong className="text-ink">Technical:</strong> security and audit logs, and error reports. Product analytics only if you accept analytics cookies.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Who processes it for us">
        <p>We share only what each provider needs to run the service:</p>
        <ul className="space-y-1.5">
          <li>• <strong className="text-ink">Google Cloud / Firebase</strong> — hosting, sign-in, database and backups.</li>
          <li>• <strong className="text-ink">AI providers</strong> (OpenAI, and/or Google Gemini, Groq or Cerebras) — receive the business details and documents you submit, to generate your analysis. If you use your own AI key, your analyses go to the provider you chose, under your own account with them.</li>
          <li>• <strong className="text-ink">SerpAPI</strong> — receives web-search queries built from your business idea and location.</li>
          <li>• <strong className="text-ink">Stripe</strong> — payments. Never receives your analysis content.</li>
          <li>• <strong className="text-ink">Resend</strong> — sends account and report emails (your email address and the email content).</li>
          <li>• <strong className="text-ink">Sentry</strong> — error reports, which can include technical details of the request that failed.</li>
          <li>• <strong className="text-ink">PostHog</strong> — product analytics, <em>only</em> if you accept analytics cookies; identified by an internal account ID, not your email.</li>
        </ul>
        <p>
          We do not sell your data. If you enter a client&apos;s confidential information into a study, you confirm you
          have the right to share it with these providers for the purpose of producing that study.
        </p>
      </LegalSection>

      <LegalSection title="Model training — off unless you turn it on">
        <p>
          We do <strong className="text-ink">not</strong> use your analyses to train models unless you turn this on in{" "}
          <strong className="text-ink">Settings → Model training</strong>. If you do, the prompts and results of your
          analyses — including the business details you entered — are kept to improve FeasibilityAI&apos;s own models.
          Turning it off stops collection for all future analyses. Analyses run on your own AI key are never kept.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          We use cookies and local storage that are necessary to keep you signed in and remember your settings.
          Analytics cookies (PostHog) are set only if you accept them in the cookie banner; you can change your choice
          by clearing this site&apos;s data in your browser.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <ul className="space-y-1.5">
          <li>• <strong className="text-ink">Get a copy of your data:</strong> Settings → Your data → Download my data (a JSON file of your account, analyses and payments).</li>
          <li>• <strong className="text-ink">Delete your account:</strong> Settings → Your data → Delete my account. This permanently deletes your account, analyses, saved key, invitations and any training data from your account.</li>
          <li>• For anything else — correction, objection, restriction, or a complaint — contact <ContactLink />. You may also complain to your local data-protection authority.</li>
        </ul>
      </LegalSection>

      <LegalSection title="How long we keep data">
        <p>
          Account and analysis data are kept while your account exists and deleted when you delete your account.
          Payment records and security audit logs are kept for as long as the law requires for accounting and
          fraud-prevention purposes, even after account deletion. Backups are kept for up to 14 weeks.
        </p>
      </LegalSection>

      <LegalSection title="International transfers">
        <p>
          Our providers may process data outside your country, including in the United States. Where required, we rely
          on the providers&apos; standard contractual safeguards.
        </p>
      </LegalSection>

      <p className="text-sm text-muted">
        See also the <Link href="/terms" className="text-brand underline">Terms of Service</Link>.
      </p>
    </LegalShell>
  );
}
