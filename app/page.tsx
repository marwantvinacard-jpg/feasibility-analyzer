"use client";

import Link from "next/link";
import { Container, Button, Eyebrow, Badge } from "@/components/kit";
import { Logo, Mark } from "@/components/Brand";
import { ScoreGauge, ScoreBar } from "@/components/ScoreGauge";
import { Icon } from "@/components/icons";
import { DIMENSION_META } from "@/lib/ui";
import { useT } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <SiteNav />
      <Hero />
      <LogoStrip />
      <HowItWorks />
      <Dimensions />
      <SampleReport />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}

function SiteNav() {
  const t = useT();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-paper/85 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#how" className="transition-colors hover:text-ink">{t("nav.howItWorks")}</a>
          <a href="#dimensions" className="transition-colors hover:text-ink">{t("nav.whatWeAnalyze")}</a>
          <a href="#pricing" className="transition-colors hover:text-ink">{t("nav.pricing")}</a>
          <a href="#faq" className="transition-colors hover:text-ink">{t("nav.faq")}</a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:block" />
          <Button href="/login" variant="ghost" className="hidden sm:inline-flex">{t("nav.logIn")}</Button>
          <Button href="/signup">{t("nav.getStarted")}</Button>
        </div>
      </Container>
    </header>
  );
}

function Hero() {
  const t = useT();
  return (
    <section className="bg-paper-glow relative overflow-hidden border-b border-border/60">
      <Container className="grid gap-14 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="animate-fade-up">
          <Badge className="mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-go" /> {t("landing.badge")}
          </Badge>
          <h1 className="font-display text-[2.75rem] font-semibold leading-[1.02] tracking-tightest sm:text-6xl">
            {t("landing.heroTitle1")}<br />
            {t("landing.heroTitle2")} <span className="italic text-brand">{t("landing.heroTitle2Emph")}</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{t("landing.heroBody")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href="/signup" className="px-5 text-base">
              {t("landing.ctaAnalyze")} <Icon name="arrow" size={18} />
            </Button>
          </div>
          <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-faint">
            <Icon name="check" size={15} className="text-go" /> {t("landing.microFreeCredits")}
            <span className="text-border">·</span> {t("landing.microNoCard")}
            <span className="text-border">·</span> {t("landing.microOwnKey")}
          </p>
        </div>
        <div className="animate-fade-up [animation-delay:120ms]">
          <VerdictPreview />
        </div>
      </Container>
    </section>
  );
}

/** A polished "sample verdict" card that sells the output at a glance. */
function VerdictPreview() {
  const t = useT();
  const scores = [
    ["market", 74],
    ["financial", 95],
    ["technical", 71],
    ["competitive", 68],
    ["location", 76],
    ["risk", 72],
  ] as const;
  return (
    <div className="card p-6 shadow-lift">
      <div className="flex items-center justify-between">
        <div>
          <div className="label">{t("landing.previewLabel")}</div>
          <div className="mt-1 font-display text-lg font-semibold">{t("landing.previewTitle")}</div>
        </div>
        <Badge tone="warn">{t("landing.previewVerdict")}</Badge>
      </div>
      <div className="mt-5 flex items-center gap-6">
        <ScoreGauge score={79} size={150} sublabel="Feasible" />
        <div className="flex-1 space-y-2.5">
          {scores.map(([key, val]) => (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted">
                  <Icon name={DIMENSION_META[key].icon} size={14} /> {t(`dim.${key}`)}
                </span>
                <span className="num font-semibold">{val}</span>
              </div>
              <ScoreBar score={val} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5 text-center">
        <Stat label={t("landing.statMonthlyProfit")} value="$26k" />
        <Stat label={t("landing.statBreakEven")} value="5 mo" />
        <Stat label={t("landing.statMargin")} value="38%" />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="num text-lg font-semibold">{value}</div>
      <div className="mt-0.5 text-[0.7rem] text-faint">{label}</div>
    </div>
  );
}

function LogoStrip() {
  const t = useT();
  return (
    <Container className="py-9">
      <p className="text-center text-xs uppercase tracking-[0.2em] text-faint">{t("landing.logoStrip")}</p>
    </Container>
  );
}

function HowItWorks() {
  const t = useT();
  const steps = [
    { n: "01", t: t("landing.how1Title"), d: t("landing.how1Body") },
    { n: "02", t: t("landing.how2Title"), d: t("landing.how2Body") },
    { n: "03", t: t("landing.how3Title"), d: t("landing.how3Body") },
  ];
  return (
    <section id="how" className="py-16 sm:py-24">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center"><Eyebrow>{t("landing.howEyebrow")}</Eyebrow></div>
          <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("landing.howTitle")}</h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="card p-6">
              <div className="num text-sm font-semibold text-brand">{s.n}</div>
              <h3 className="mt-2 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Dimensions() {
  const t = useT();
  return (
    <section id="dimensions" className="border-y border-border/60 bg-surface-2/40 py-16 sm:py-24">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center"><Eyebrow>{t("landing.dimEyebrow")}</Eyebrow></div>
          <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("landing.dimTitle")}</h2>
          <p className="mt-4 leading-relaxed text-muted">{t("landing.dimBody")}</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(DIMENSION_META).map(([key, d]) => (
            <div key={key} className="card p-6 transition hover:-translate-y-0.5 hover:shadow-lift">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                <Icon name={d.icon} size={22} />
              </span>
              <h3 className="mt-4 text-lg font-semibold">{t(`dim.${key}`)}</h3>
              <p className="mt-1 text-sm text-muted">{t(`dim.${key}.blurb`)}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function SampleReport() {
  const t = useT();
  const features = [
    t("landing.reportFeature1"),
    t("landing.reportFeature2"),
    t("landing.reportFeature3"),
    t("landing.reportFeature4"),
    t("landing.reportFeature5"),
    t("landing.reportFeature6"),
  ];
  const stats: [string, string][] = [
    [t("landing.sampleTopStrength"), t("landing.sampleTopStrengthVal")],
    [t("landing.sampleWatchOut"), t("landing.sampleWatchOutVal")],
    [t("landing.sampleTiming"), t("landing.sampleTimingVal")],
    [t("landing.sampleCapital"), "$252,000"],
  ];
  return (
    <section className="py-16 sm:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Eyebrow>{t("landing.reportEyebrow")}</Eyebrow>
          <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("landing.reportTitle")}</h2>
          <ul className="mt-6 space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-go/15 text-go">
                  <Icon name="check" size={13} strokeWidth={2.5} />
                </span>
                <span className="text-muted">{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Button href="/signup">{t("landing.reportCta")}</Button>
          </div>
        </div>
        <div className="card p-6 shadow-lift">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="font-display font-semibold">{t("landing.sampleExecSummary")}</div>
            <Badge tone="warn"><span className="num">79</span> / 100</Badge>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {t("landing.sampleBody1")}{" "}
            <strong className="text-ink">{t("landing.sampleBody2")}</strong>
            {t("landing.sampleBody3")}{" "}
            <strong className="text-warn">{t("landing.sampleBody4")}</strong>{" "}
            {t("landing.sampleBody5")}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {stats.map(([k, v]) => (
              <div key={k} className="rounded-xl bg-surface-2 p-3">
                <div className="text-[0.7rem] text-faint">{k}</div>
                <div className="text-sm font-semibold">{v}</div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function Pricing() {
  const t = useT();
  return (
    <section id="pricing" className="border-y border-border/60 bg-surface-2/40 py-16 sm:py-24">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center"><Eyebrow>{t("landing.pricingEyebrow")}</Eyebrow></div>
          <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("landing.pricingTitle")}</h2>
          <p className="mt-4 leading-relaxed text-muted">{t("landing.pricingBody")}</p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-3">
          <PlanCard name={t("landing.planStarter")} price={t("landing.planStarterPrice")} note={t("landing.planStarterNote")} features={[t("landing.f.freeReports"), t("landing.f.fullAnalysis"), t("landing.f.pdfDownload")]} />
          <PlanCard name={t("landing.planCredits")} price={t("landing.planCreditsPrice")} note={t("landing.planCreditsNote")} highlight features={[t("landing.f.buyPacks"), t("landing.f.priority"), t("landing.f.shareLinks")]} />
          <PlanCard name={t("landing.planByok")} price={t("landing.planByokPrice")} note={t("landing.planByokNote")} features={[t("landing.f.ownKey"), t("landing.f.noCredit"), t("landing.f.higherLimits")]} />
        </div>
      </Container>
    </section>
  );
}

function PlanCard({
  name,
  price,
  note,
  features,
  highlight,
}: {
  name: string;
  price: string;
  note: string;
  features: string[];
  highlight?: boolean;
}) {
  const t = useT();
  return (
    <div className={`card p-6 ${highlight ? "ring-2 ring-brand shadow-lift" : ""}`}>
      {highlight && <Badge tone="go" className="mb-3">{t("landing.mostPopular")}</Badge>}
      <div className="text-sm text-muted">{name}</div>
      <div className="font-display mt-1 text-2xl font-semibold">{price}</div>
      <div className="text-xs text-faint">{note}</div>
      <ul className="mt-4 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-muted">
            <Icon name="check" size={15} className="text-go" /> {f}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Button href="/signup" variant={highlight ? "primary" : "ghost"} className="w-full">{t("nav.getStarted")}</Button>
      </div>
    </div>
  );
}

function FAQ() {
  const t = useT();
  const faqs: [string, string][] = [
    [t("landing.faqQ1"), t("landing.faqA1")],
    [t("landing.faqQ2"), t("landing.faqA2")],
    [t("landing.faqQ3"), t("landing.faqA3")],
    [t("landing.faqQ4"), t("landing.faqA4")],
  ];
  return (
    <section id="faq" className="py-16 sm:py-24">
      <Container className="max-w-3xl">
        <div className="text-center">
          <div className="flex justify-center"><Eyebrow>{t("landing.faqEyebrow")}</Eyebrow></div>
          <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t("landing.faqTitle")}</h2>
        </div>
        <div className="mt-10 divide-y divide-border">
          {faqs.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {q}
                <Icon name="plus" size={18} className="text-faint transition group-open:rotate-45" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Footer() {
  const t = useT();
  return (
    <footer className="border-t border-border py-10">
      <Container className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Mark className="h-6 w-6" /> {t("common.appName")}
        </div>
        <p className="text-xs text-faint">© {new Date().getFullYear()} {t("common.appName")} · {t("landing.footerNote")}</p>
        <div className="flex gap-5 text-sm text-muted">
          <Link href="/login" className="hover:text-ink">{t("nav.logIn")}</Link>
          <Link href="/signup" className="hover:text-ink">{t("nav.getStarted")}</Link>
        </div>
      </Container>
    </footer>
  );
}
