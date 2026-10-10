import Link from "next/link";
import { Icon } from "@/components/icons";
import { LEGAL, legalPlaceholdersRemaining } from "@/lib/legal";

/** Public layout for /terms and /privacy (no login needed). */
export function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  const missing = legalPlaceholdersRemaining();
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <div>
        <Link href="/" className="text-sm text-brand hover:underline">← FeasibilityAI</Link>
        <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-muted">
          Version {LEGAL.version} · <Link href="/terms" className="underline">Terms</Link> ·{" "}
          <Link href="/privacy" className="underline">Privacy</Link> ·{" "}
          <Link href="/dpa" className="underline">DPA</Link>
        </p>
      </div>
      {missing.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          <Icon name="risk" size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>
            Not ready for launch: company details still need filling in ({missing.join(", ")}) in <code>lib/legal.ts</code>.
          </span>
        </div>
      )}
      {children}
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export const ContactLink = () => (
  <a href={`mailto:${LEGAL.contactEmail}`} className="text-brand underline">{LEGAL.contactEmail}</a>
);
