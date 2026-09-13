"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { StageProgress } from "@/components/StageProgress";
import { Paywall } from "@/components/Paywall";
import { VERTICALS } from "@/lib/engine/verticals";
import { useSession } from "@/lib/session";
import { getIdToken } from "@/lib/analyses";
import { streamAnalyze } from "@/lib/sse";
import { SIX_STAGES, type BusinessInput, type StageName, type StageStatus } from "@/lib/engine/types";
import { cn } from "@/lib/ui";
import { useT, useLanguage } from "@/lib/i18n/LanguageContext";
import { CURRENCIES, currencySymbol } from "@/lib/currencies";

type FieldKey = keyof BusinessInput;

function useTextFields(t: ReturnType<typeof useT>): { key: FieldKey; label: string; placeholder: string; long?: boolean }[] {
  return [
    { key: "business_idea", label: t("newA.businessIdea"), placeholder: t("newA.bizIdeaPh"), long: true },
    { key: "target_customer", label: t("newA.targetCustomer"), placeholder: t("newA.targetCustomerPh") },
    { key: "location", label: t("newA.location"), placeholder: t("newA.locationPh") },
    { key: "problem_solved", label: t("newA.problemSolved"), placeholder: t("newA.problemPh"), long: true },
    { key: "product_service", label: t("newA.productService"), placeholder: t("newA.productPh"), long: true },
    { key: "revenue_model", label: t("newA.revenueModel"), placeholder: t("newA.revenuePh") },
    { key: "competitors", label: t("newA.competitors"), placeholder: t("newA.competitorsPh") },
    { key: "unique_advantage", label: t("newA.uniqueAdvantage"), placeholder: t("newA.advantagePh"), long: true },
  ];
}

const TEXT_FIELDS_KEYS: FieldKey[] = [
  "business_idea", "target_customer", "location", "problem_solved",
  "product_service", "revenue_model", "competitors", "unique_advantage",
];

const emptyInput: BusinessInput = {
  business_idea: "", target_customer: "", location: "", problem_solved: "", product_service: "",
  revenue_model: "", competitors: "", monthly_cost: 0, monthly_revenue: 0, unique_advantage: "", currency: "USD",
};

const FILLED = (v: unknown) => (typeof v === "number" ? v > 0 : String(v ?? "").trim().length > 2);
const KEYS: FieldKey[] = [...TEXT_FIELDS_KEYS, "monthly_cost", "monthly_revenue"];
const initialStages = () => Object.fromEntries(SIX_STAGES.map((s) => [s, "pending"])) as Record<StageName, StageStatus>;

export default function NewAnalysis() {
  const { user } = useSession();
  const router = useRouter();
  const t = useT();
  const { lang } = useLanguage();
  const TEXT_FIELDS = useTextFields(t);

  const [input, setInput] = useState<BusinessInput>(emptyInput);
  const [describe, setDescribe] = useState("");
  const [prefilling, setPrefilling] = useState(false);
  const [prefillNote, setPrefillNote] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"form" | "running">("form");
  const [stageStatus, setStageStatus] = useState<Record<StageName, StageStatus>>(initialStages);

  type Doc = { name: string; chars: number; truncated: boolean; text: string };
  const [docs, setDocs] = useState<Doc[]>([]);
  const [ingesting, setIngesting] = useState(false);
  const [ingestNote, setIngestNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const knowledgeBase = useMemo(
    () => docs.map((d) => `### ${d.name}\n${d.text}`).join("\n\n").slice(0, 20000),
    [docs]
  );

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setIngesting(true);
    setIngestNote("");
    for (const file of Array.from(list)) {
      try {
        const token = await getIdToken();
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/ingest", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not read file");
        setDocs((p) => [...p.filter((d) => d.name !== data.name), data as Doc]);
      } catch (e) {
        setIngestNote(e instanceof Error ? e.message : "Upload failed");
      }
    }
    setIngesting(false);
    if (fileRef.current) fileRef.current.value = "";
  }
  const removeDoc = (name: string) => setDocs((p) => p.filter((d) => d.name !== name));

  const filledCount = useMemo(() => KEYS.filter((k) => FILLED(input[k])).length, [input]);
  const completeness = Math.round((filledCount / KEYS.length) * 100);
  const missing = KEYS.filter((k) => !FILLED(input[k]));

  function set<K extends FieldKey>(key: K, value: BusinessInput[K]) {
    setInput((p) => ({ ...p, [key]: value }));
  }

  async function prefill() {
    if (describe.trim().length < 8) return;
    setPrefilling(true);
    setPrefillNote("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: describe, previous: input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not extract");
      setInput((p) => ({ ...p, ...cleanMerge(p, data.data as Partial<BusinessInput>) }));
      setPrefillNote(
        data.completeness >= 100 ? "Filled every field — review and run." : `Filled fields · ${data.missingFieldsReadable?.length ?? 0} still need you.`
      );
    } catch (e) {
      setPrefillNote(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setPrefilling(false);
    }
  }

  async function run() {
    setError("");
    if (completeness < 100) {
      setError(t("newA.errMissing", { n: missing.length }));
      return;
    }
    if (user!.credits < 1) {
      setError(t("newA.errNoCredits"));
      return;
    }
    setPhase("running");
    setStageStatus(initialStages());
    try {
      const token = await getIdToken();
      await streamAnalyze(
        {
          ...input,
          monthly_cost: Number(input.monthly_cost),
          monthly_revenue: Number(input.monthly_revenue),
          // Blank optionals would otherwise reach the model as a stated budget
          // of zero or an empty funding preference.
          capex_budget: Number(input.capex_budget) > 0 ? Number(input.capex_budget) : undefined,
          funding_preference: input.funding_preference?.trim() || undefined,
          knowledge_base: knowledgeBase || undefined,
          report_language: lang,
        },
        token,
        {
          onProgress: ({ stage, status }) =>
            setStageStatus((prev) => ({ ...prev, [stage as StageName]: status as StageStatus })),
          onDone: ({ analysisId }) => router.push(`/app/analysis/${analysisId}`),
          onError: (message) => { setError(message); setPhase("form"); },
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start analysis.");
      setPhase("form");
    }
  }

  if (!user) return null;

  if (user.credits < 1) {
    return <Paywall credits={user.credits} />;
  }

  if (phase === "running") {
    return (
      <div className="py-6">
        <StageProgress status={stageStatus} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("newA.greeting", { name: user.name.split(" ")[0] })}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("newA.formHint")}</p>
      </div>

      {user.orgId && (
        <div className="card p-5">
          <label className="mb-1.5 block text-sm font-medium">{t("newA.clientName")}</label>
          <input
            className="input"
            placeholder={t("newA.clientNamePh")}
            value={input.client_name ?? ""}
            onChange={(e) => set("client_name", e.target.value)}
          />
          <p className="mt-1.5 text-xs text-faint">{t("newA.clientNameHint")}</p>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center gap-2">
          <Badge tone="go"><Icon name="spark" size={13} /> {t("newA.aiPrefillBadge")}</Badge>
          <span className="text-sm text-muted">{t("newA.pasteHint")}</span>
        </div>
        <textarea
          className="input mt-3 min-h-[90px] resize-y"
          placeholder={t("newA.describePlaceholder")}
          value={describe}
          onChange={(e) => setDescribe(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-3">
          <Button variant="ghost" onClick={prefill} disabled={prefilling || describe.trim().length < 8}>
            {prefilling ? t("newA.reading") : <>{t("newA.prefillBtn")} <Icon name="arrow" size={16} /></>}
          </Button>
          {prefillNote && <span className="text-xs text-muted">{prefillNote}</span>}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2">
          <Badge tone="go"><Icon name="doc" size={13} /> {t("newA.kbBadge")}</Badge>
          <span className="text-sm text-muted">{t("newA.kbHint")}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={ingesting}
            className="btn btn-ghost text-sm"
          >
            <Icon name="plus" size={15} /> {ingesting ? t("newA.reading") : t("newA.addFiles")}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.xls,.csv,.tsv,.txt,.md,.json"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          {ingestNote && <span className="text-xs text-stop">{ingestNote}</span>}
        </div>
        {docs.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {docs.map((d) => (
              <li key={d.name} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 truncate">
                  <Icon name="doc" size={14} className="shrink-0 text-muted" />
                  <span className="truncate">{d.name}</span>
                  <span className="shrink-0 text-xs text-faint">{(d.chars / 1000).toFixed(1)}k chars{d.truncated ? " · truncated" : ""}</span>
                </span>
                <button type="button" onClick={() => removeDoc(d.name)} className="shrink-0 text-faint hover:text-stop" aria-label={`Remove ${d.name}`}>
                  <Icon name="x" size={14} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {docs.length > 0 && (
          <p className="mt-2 text-xs text-faint">
            {t("newA.willAttach", { k: (knowledgeBase.length / 1000).toFixed(1) })}
          </p>
        )}
      </div>

      <div className="card flex items-center gap-4 p-4">
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium">{t("newA.completenessLabel")}</span>
            <span className="num text-muted">{completeness}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-border/60">
            <div className={cn("h-full rounded-full transition-all", completeness === 100 ? "bg-go" : "bg-brand")} style={{ width: `${completeness}%` }} />
          </div>
        </div>
        <Badge tone={completeness === 100 ? "go" : "warn"}>{t("newA.fieldsCount", { n: filledCount })}</Badge>
      </div>

      <div className="card space-y-5 p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {TEXT_FIELDS.map((f) => (
            <div key={f.key} className={f.long ? "sm:col-span-2" : ""}>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                {f.label}
                {FILLED(input[f.key]) && <Icon name="check" size={14} className="text-go" strokeWidth={2.5} />}
              </label>
              {f.long ? (
                <textarea className="input min-h-[70px] resize-y" placeholder={f.placeholder} value={String(input[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value as never)} />
              ) : (
                <input className="input" placeholder={f.placeholder} value={String(input[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value as never)} />
              )}
            </div>
          ))}
          <NumberField label={t("newA.monthlyCost")} value={input.monthly_cost} onChange={(n) => set("monthly_cost", n)} currency={input.currency} />
          <NumberField label={t("newA.monthlyRevenue")} value={input.monthly_revenue} onChange={(n) => set("monthly_revenue", n)} currency={input.currency} />
        </div>
        <p className="text-xs text-faint">{t("newA.costHint")}</p>
      </div>

      <details className="card group p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Icon name="financial" size={16} className="text-brand" />
            {t("newA.financialOptions")}
            <span className="text-xs font-normal text-faint">{t("newA.optionalDefaults")}</span>
          </span>
          <Icon name="chevron" size={16} className="text-faint transition group-open:rotate-180" />
        </summary>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("newA.industry")}</label>
            <select className="input" value={input.business_type ?? ""} onChange={(e) => set("business_type", e.target.value as never)}>
              <option value="">{t("newA.generalNotListed")}</option>
              {VERTICALS.map((v) => (
                <option key={v.key} value={v.key}>{v.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-faint">{t("newA.industryHint")}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("newA.currency")}</label>
            <select
              className="input"
              value={input.currency ?? "USD"}
              onChange={(e) => set("currency", e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}{c.symbol ? ` (${c.symbol})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("newA.projectionYears")}</label>
            <select
              className="input"
              value={input.projection_years ?? 5}
              onChange={(e) => set("projection_years", Number(e.target.value))}
            >
              {[3, 4, 5].map((y) => (
                <option key={y} value={y}>{t("newA.years", { n: y })}</option>
              ))}
            </select>
          </div>
          <NumberField
            label={t("newA.capexBudget")}
            value={input.capex_budget ?? 0}
            onChange={(n) => set("capex_budget", n)}
            currency={input.currency}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("newA.fundingMixLabel")}</label>
            <input
              className="input"
              placeholder={t("newA.fundingMixPlaceholder")}
              value={input.funding_preference ?? ""}
              onChange={(e) => set("funding_preference", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">{t("newA.protocolLabel")}</label>
            <textarea
              className="input min-h-[70px] resize-y"
              placeholder={t("newA.protocolPlaceholder")}
              value={input.study_protocol ?? ""}
              onChange={(e) => set("study_protocol", e.target.value)}
            />
            <p className="mt-1 text-xs text-faint">{t("newA.protocolHint")}</p>
          </div>
        </div>
      </details>

      {error && <p className="text-sm text-stop">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-xs text-faint">{t("newA.costCredits", { n: user.credits })}</p>
        <Button onClick={run} disabled={completeness < 100}>{t("newA.run")} <Icon name="arrow" size={18} /></Button>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, currency }: { label: string; value: number; onChange: (n: number) => void; currency?: string }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
        {label}
        {value > 0 && <Icon name="check" size={14} className="text-go" strokeWidth={2.5} />}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-faint">{currencySymbol(currency)}</span>
        <input className="input ps-7" type="number" min={0} placeholder="0" value={value || ""} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    </div>
  );
}

function cleanMerge(prev: BusinessInput, next: Partial<BusinessInput>): Partial<BusinessInput> {
  const out: Partial<BusinessInput> = {};
  for (const [k, v] of Object.entries(next) as [FieldKey, unknown][]) {
    if (v === undefined || v === null || v === "") continue;
    if (!FILLED(prev[k])) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
