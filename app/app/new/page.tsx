"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge } from "@/components/kit";
import { useSession } from "@/lib/session";
import { newId, saveAnalysis } from "@/lib/store";
import type { BusinessInput } from "@/lib/engine/types";
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
  business_idea: "",
  target_customer: "",
  location: "",
  problem_solved: "",
  product_service: "",
  revenue_model: "",
  competitors: "",
  monthly_cost: 0,
  monthly_revenue: 0,
  unique_advantage: "",
  currency: "USD",
};

const FILLED = (v: unknown) => (typeof v === "number" ? v > 0 : String(v ?? "").trim().length > 2);
const KEYS: FieldKey[] = [...TEXT_FIELDS.map((f) => f.key), "monthly_cost", "monthly_revenue"];

export default function NewAnalysis() {
  const { user, spendCredit } = useSession();
  const router = useRouter();

  const [input, setInput] = useState<BusinessInput>(emptyInput);
  const [describe, setDescribe] = useState("");
  const [prefilling, setPrefilling] = useState(false);
  const [prefillNote, setPrefillNote] = useState("");
  const [error, setError] = useState("");

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
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: describe, previous: input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not extract");
      const d = data.data as Partial<BusinessInput>;
      setInput((p) => ({ ...p, ...cleanMerge(p, d) }));
      setPrefillNote(
        data.completeness >= 100
          ? "Filled every field — review and run."
          : `Filled ${data.fields_provided ?? ""} fields · ${data.missingFieldsReadable?.length ?? 0} still need you.`
      );
    } catch (e) {
      setPrefillNote(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setPrefilling(false);
    }
  }

  function run() {
    setError("");
    if (completeness < 100) {
      setError(`Please fill all 10 fields for an accurate report. Missing ${missing.length}.`);
      return;
    }
    if (user!.keyMode === "platform" && user!.credits < 1) {
      setError("You're out of credits. Add your own key in Settings or top up.");
      return;
    }
    const id = newId();
    saveAnalysis({
      id,
      uid: user!.uid,
      createdAt: Date.now(),
      status: "queued",
      input: { ...input, monthly_cost: Number(input.monthly_cost), monthly_revenue: Number(input.monthly_revenue) },
    });
    if (user!.keyMode === "platform") spendCredit(user!.uid);
    router.push(`/app/analysis/${id}`);
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New feasibility analysis</h1>
        <p className="mt-1 text-sm text-muted">Fill the 10 fields below — or describe your idea and let AI pre-fill them.</p>
      </div>

      {/* AI pre-fill */}
      <div className="card p-5">
        <div className="flex items-center gap-2">
          <Badge tone="go">✨ AI pre-fill</Badge>
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
            {prefilling ? "Reading…" : "Pre-fill fields →"}
          </Button>
          {prefillNote && <span className="text-xs text-muted">{prefillNote}</span>}
        </div>
      </div>

      {/* Completeness meter */}
      <div className="card flex items-center gap-4 p-4">
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium">Completeness</span>
            <span className="tabular-nums text-muted">{completeness}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-border/60">
            <div
              className={cn("h-full rounded-full transition-all", completeness === 100 ? "bg-go" : "bg-brand")}
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>
        <Badge tone={completeness === 100 ? "go" : "warn"}>{filledCount}/10 fields</Badge>
      </div>

      {/* Fields */}
      <div className="card space-y-5 p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {TEXT_FIELDS.map((f) => (
            <div key={f.key} className={f.long ? "sm:col-span-2" : ""}>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                {f.label}
                {FILLED(input[f.key]) && <span className="text-go">✓</span>}
              </label>
              {f.long ? (
                <textarea
                  className="input min-h-[70px] resize-y"
                  placeholder={f.placeholder}
                  value={String(input[f.key] ?? "")}
                  onChange={(e) => set(f.key, e.target.value as never)}
                />
              ) : (
                <input
                  className="input"
                  placeholder={f.placeholder}
                  value={String(input[f.key] ?? "")}
                  onChange={(e) => set(f.key, e.target.value as never)}
                />
              )}
            </div>
          ))}

          {/* Numeric */}
          <NumberField
            label="Monthly operating cost"
            value={input.monthly_cost}
            onChange={(n) => set("monthly_cost", n)}
            currency={input.currency}
          />
          <NumberField
            label="Expected monthly revenue"
            value={input.monthly_revenue}
            onChange={(n) => set("monthly_revenue", n)}
            currency={input.currency}
          />
        </div>
      </div>

      {error && <p className="text-sm text-stop">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-xs text-faint">
          {user.keyMode === "platform" ? `Costs 1 credit · ${user.credits} remaining` : "Running on your own key"}
        </p>
        <Button onClick={run} disabled={completeness < 100}>Run analysis →</Button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  currency,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  currency?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
        {label}
        {value > 0 && <span className="text-go">✓</span>}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-faint">
          {currency === "USD" ? "$" : currency}
        </span>
        <input
          className="input pl-7"
          type="number"
          min={0}
          placeholder="0"
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}

/** Only overwrite empty fields with pre-filled values (don't clobber user edits). */
function cleanMerge(prev: BusinessInput, next: Partial<BusinessInput>): Partial<BusinessInput> {
  const out: Partial<BusinessInput> = {};
  for (const [k, v] of Object.entries(next) as [FieldKey, unknown][]) {
    if (v === undefined || v === null || v === "") continue;
    if (!FILLED(prev[k])) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}
