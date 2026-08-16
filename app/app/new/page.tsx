"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { StageProgress } from "@/components/StageProgress";
import { useSession } from "@/lib/session";
import { streamAnalyze } from "@/lib/sse";
import { getIdToken } from "@/lib/firebase/analyses";
import { SIX_STAGES, type BusinessInput, type StageName, type StageStatus } from "@/lib/engine/types";
import { cn } from "@/lib/ui";

type FieldKey = keyof BusinessInput;

const TEXT_FIELDS: { key: FieldKey; label: string; placeholder: string; long?: boolean }[] = [
  { key: "business_idea", label: "Business idea", placeholder: "What is the business, in one or two sentences?", long: true },
  { key: "target_customer", label: "Target customer", placeholder: "Who exactly will buy this?" },
  { key: "location", label: "Location", placeholder: "City, Country" },
  { key: "problem_solved", label: "Problem solved", placeholder: "What pain point does it address?", long: true },
  { key: "product_service", label: "Product / service", placeholder: "What exactly are you selling?", long: true },
  { key: "revenue_model", label: "Revenue model", placeholder: "How do you make money? Pricing?" },
  { key: "competitors", label: "Main competitors", placeholder: "Name the key competitors" },
  { key: "unique_advantage", label: "Unique advantage", placeholder: "What makes you different / better?", long: true },
];

const emptyInput: BusinessInput = {
  business_idea: "", target_customer: "", location: "", problem_solved: "", product_service: "",
  revenue_model: "", competitors: "", monthly_cost: 0, monthly_revenue: 0, unique_advantage: "", currency: "USD",
};

const FILLED = (v: unknown) => (typeof v === "number" ? v > 0 : String(v ?? "").trim().length > 2);
const KEYS: FieldKey[] = [...TEXT_FIELDS.map((f) => f.key), "monthly_cost", "monthly_revenue"];
const initialStages = () => Object.fromEntries(SIX_STAGES.map((s) => [s, "pending"])) as Record<StageName, StageStatus>;

export default function NewAnalysis() {
  const { user } = useSession();
  const router = useRouter();

  const [input, setInput] = useState<BusinessInput>(emptyInput);
  const [describe, setDescribe] = useState("");
  const [prefilling, setPrefilling] = useState(false);
  const [prefillNote, setPrefillNote] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"form" | "running">("form");
  const [stageStatus, setStageStatus] = useState<Record<StageName, StageStatus>>(initialStages);

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
      setError(`Please fill all 10 fields for an accurate report. Missing ${missing.length}.`);
      return;
    }
    if (user!.credits < 1) {
      setError("You're out of credits. Ask an admin to add more, or contact support.");
      return;
    }
    setPhase("running");
    setStageStatus(initialStages());
    try {
      const token = await getIdToken();
      await streamAnalyze(
        { ...input, monthly_cost: Number(input.monthly_cost), monthly_revenue: Number(input.monthly_revenue) },
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
        <h1 className="font-display text-3xl font-semibold tracking-tight">New feasibility analysis</h1>
        <p className="mt-1.5 text-sm text-muted">Fill the 10 fields below — or describe your idea and let AI pre-fill them.</p>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2">
          <Badge tone="go"><Icon name="spark" size={13} /> AI pre-fill</Badge>
          <span className="text-sm text-muted">Paste a paragraph about your business</span>
        </div>
        <textarea
          className="input mt-3 min-h-[90px] resize-y"
          placeholder="e.g. We're launching a subscription meal-prep service in Austin for busy professionals. $89/week for 5 dinners. Costs about $42k/month, expecting $68k/month revenue…"
          value={describe}
          onChange={(e) => setDescribe(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-3">
          <Button variant="ghost" onClick={prefill} disabled={prefilling || describe.trim().length < 8}>
            {prefilling ? "Reading…" : <>Pre-fill fields <Icon name="arrow" size={16} /></>}
          </Button>
          {prefillNote && <span className="text-xs text-muted">{prefillNote}</span>}
        </div>
      </div>

      <div className="card flex items-center gap-4 p-4">
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium">Completeness</span>
            <span className="num text-muted">{completeness}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-border/60">
            <div className={cn("h-full rounded-full transition-all", completeness === 100 ? "bg-go" : "bg-brand")} style={{ width: `${completeness}%` }} />
          </div>
        </div>
        <Badge tone={completeness === 100 ? "go" : "warn"}>{filledCount}/10 fields</Badge>
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
          <NumberField label="Monthly operating cost" value={input.monthly_cost} onChange={(n) => set("monthly_cost", n)} currency={input.currency} />
          <NumberField label="Expected monthly revenue" value={input.monthly_revenue} onChange={(n) => set("monthly_revenue", n)} currency={input.currency} />
        </div>
      </div>

      {error && <p className="text-sm text-stop">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-xs text-faint">Costs 1 credit · <span className="num">{user.credits}</span> remaining</p>
        <Button onClick={run} disabled={completeness < 100}>Run analysis <Icon name="arrow" size={18} /></Button>
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
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">{currency === "USD" ? "$" : currency}</span>
        <input className="input pl-7" type="number" min={0} placeholder="0" value={value || ""} onChange={(e) => onChange(Number(e.target.value))} />
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
