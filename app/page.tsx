import Link from "next/link";
import { Container, Button, Eyebrow, Badge } from "@/components/kit";
import { Logo, Mark } from "@/components/Brand";
import { ScoreGauge, ScoreBar } from "@/components/ScoreGauge";
import { DIMENSION_META } from "@/lib/ui";

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
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#dimensions" className="hover:text-ink">What we analyze</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          <a href="#faq" className="hover:text-ink">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button href="/login" variant="ghost" className="hidden sm:inline-flex">Log in</Button>
          <Button href="/signup">Get started</Button>
        </div>
      </Container>
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-grid relative overflow-hidden">
      <Container className="grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="animate-fade-up">
          <Badge className="mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-go" /> Six-dimension analysis · GO / NO-GO in minutes
          </Badge>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Know if your idea<br />
            will actually <span className="bg-gradient-to-r from-brand-2 to-brand bg-clip-text text-transparent">work</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            FeasibilityAI turns a business idea into a rigorous, investor-grade feasibility
            report — market, financial, technical, competitive, location and risk — with a clear
            score and recommendation you can act on.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href="/signup" className="text-base">Analyze my idea →</Button>
            <Button href="/login" variant="ghost" className="text-base">See a sample report</Button>
          </div>
          <p className="mt-4 text-sm text-faint">
            Free credits on approval · No credit card · Your own AI key optional
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
  const scores = [
    ["market", 74],
    ["financial", 95],
    ["technical", 71],
    ["competitive", 68],
    ["location", 76],
    ["risk", 72],
  ] as const;
  return (
    <div className="card relative p-6 shadow-glow">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-faint">Feasibility verdict</div>
          <div className="mt-1 text-lg font-semibold">Meal-prep subscription · Austin</div>
        </div>
        <Badge tone="warn">⚠️ GO with conditions</Badge>
      </div>
      <div className="mt-4 flex items-center gap-6">
        <ScoreGauge score={79} size={150} sublabel="Feasible" />
        <div className="flex-1 space-y-2.5">
          {scores.map(([key, val]) => (
            <div key={key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="capitalize text-muted">{DIMENSION_META[key].label}</span>
                <span className="font-semibold tabular-nums">{val}</span>
              </div>
              <ScoreBar score={val} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
        <Stat label="Monthly profit" value="$26k" />
        <Stat label="Break-even" value="5 mo" />
        <Stat label="Margin" value="38%" />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[0.7rem] text-faint">{label}</div>
    </div>
  );
}

function LogoStrip() {
  return (
    <Container className="py-8">
      <p className="text-center text-xs uppercase tracking-[0.2em] text-faint">
        Built for founders, consultants, accelerators & lenders evaluating new ventures
      </p>
    </Container>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Describe your idea",
      d: "Answer 10 quick questions — or paste a paragraph and let AI pre-fill them for you.",
    },
    {
      n: "02",
      t: "Six experts analyze it",
      d: "Specialist agents research market, financials, tech, competition, location and risk in parallel.",
    },
    {
      n: "03",
      t: "Get your verdict",
      d: "A weighted score, a GO / NO-GO call, the numbers behind it, and a downloadable report.",
    },
  ];
  return (
    <section id="how" className="py-16 sm:py-24">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            From rough idea to real decision in three steps
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="card p-6">
              <div className="text-sm font-bold text-brand">{s.n}</div>
              <h3 className="mt-2 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Dimensions() {
  return (
    <section id="dimensions" className="bg-dots border-y border-border/70 py-16 sm:py-24">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>What we analyze</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Six dimensions. One clear score.
          </h2>
          <p className="mt-4 text-muted">
            Every idea is scored across the six things that decide whether a business survives —
            weighted and combined into a single feasibility number.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(DIMENSION_META).map(([key, d]) => (
            <div key={key} className="card p-6 transition hover:-translate-y-0.5 hover:shadow-glow">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-xl">{d.icon}</div>
              <h3 className="mt-4 text-lg font-semibold">{d.label}</h3>
              <p className="mt-1 text-sm text-muted">{d.blurb}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function SampleReport() {
  return (
    <section className="py-16 sm:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Eyebrow>The report</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            An analyst-grade report, not a chatbot reply
          </h2>
          <ul className="mt-6 space-y-3">
            {[
              "Executive summary with a clear recommendation",
              "Exact financials — profit, margin, break-even, capital needed",
              "A ranked risk register with mitigation & contingency",
              "Competitor breakdown and positioning strategy",
              "Cited sources for every research claim",
              "Download as a polished PDF",
            ].map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-go/15 text-go">✓</span>
                <span className="text-muted">{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Button href="/signup">Create your first report</Button>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="font-semibold">Executive Summary</div>
            <Badge tone="warn">79 / 100</Badge>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            A subscription meal-prep service targeting time-poor Austin professionals scores{" "}
            <strong className="text-ink">79/100 — Feasible</strong>. Strong unit economics
            (38% margin, 5-month break-even) and a growing market offset moderate competitive
            intensity. Recommendation:{" "}
            <strong className="text-warn">GO, with conditions</strong> — validate demand with a
            design-partner cohort before scaling spend.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["Top strength", "Solid financial projections"],
              ["Watch-out", "Incumbent price response"],
              ["Market timing", "Growing"],
              ["Startup capital", "$252,000"],
            ].map(([k, v]) => (
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
  return (
    <section id="pricing" className="bg-dots border-y border-border/70 py-16 sm:py-24">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Start free. Scale on credits.</h2>
          <p className="mt-4 text-muted">
            Every analysis costs one credit. New accounts get free credits on approval. Power users
            can plug in their own AI key and run at cost.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-3">
          <PlanCard name="Starter" price="Free" note="On approval" features={["3 free reports", "Full 6-dimension analysis", "PDF download"]} />
          <PlanCard
            name="Credits"
            price="Pay as you go"
            note="Top up anytime"
            highlight
            features={["Buy report packs", "Priority processing", "Shareable report links"]}
          />
          <PlanCard name="Bring your own key" price="At cost" note="Power users" features={["Use your own AI key", "No per-report credit", "Higher rate limits"]} />
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
  return (
    <div className={`card p-6 ${highlight ? "ring-2 ring-brand shadow-glow" : ""}`}>
      {highlight && <Badge tone="go" className="mb-3">Most popular</Badge>}
      <div className="text-sm text-muted">{name}</div>
      <div className="mt-1 text-2xl font-bold">{price}</div>
      <div className="text-xs text-faint">{note}</div>
      <ul className="mt-4 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-muted">
            <span className="text-go">✓</span> {f}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Button href="/signup" variant={highlight ? "primary" : "ghost"} className="w-full">
          Get started
        </Button>
      </div>
    </div>
  );
}

function FAQ() {
  const faqs = [
    ["How accurate is the analysis?", "Financials are computed deterministically from your inputs; the qualitative analysis is researched by specialist AI agents and every claim is cited. It's a decision aid, not a guarantee."],
    ["Do I need my own AI key?", "No. Accounts run on our platform key with free credits. If you're a heavy user, you can add your own key in settings and run at cost with higher limits."],
    ["Why do I need to be approved?", "To keep quality high and prevent abuse, new accounts are reviewed by an admin before they can run analyses. You'll be notified the moment you're approved."],
    ["What do I get at the end?", "An interactive scorecard plus a downloadable, professionally formatted PDF report you can share with partners, investors or lenders."],
  ];
  return (
    <section id="faq" className="py-16 sm:py-24">
      <Container className="max-w-3xl">
        <div className="text-center">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Questions, answered</h2>
        </div>
        <div className="mt-10 divide-y divide-border">
          {faqs.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {q}
                <span className="text-faint transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <Container className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Mark className="h-6 w-6" /> FeasibilityAI
        </div>
        <p className="text-xs text-faint">© {new Date().getFullYear()} FeasibilityAI · Concept build</p>
        <div className="flex gap-5 text-sm text-muted">
          <Link href="/login" className="hover:text-ink">Log in</Link>
          <Link href="/signup" className="hover:text-ink">Get started</Link>
        </div>
      </Container>
    </footer>
  );
}
