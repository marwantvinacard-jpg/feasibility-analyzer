"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { subscribeAnalysis, saveFinancialModel } from "@/lib/analyses";
import { useSession } from "@/lib/session";
import type { AnalysisDoc } from "@/lib/analysisTypes";
import { FinancialModelSchema, type FinancialModel, type CapexItem, type OpexItem, type RevenueStream } from "@/lib/engine/financialModel";
import { buildProjections } from "@/lib/engine/projections";
import { money, cn } from "@/lib/ui";

export default function EditModelPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const { user } = useSession();
  const [rec, setRec] = useState<AnalysisDoc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [model, setModel] = useState<FinancialModel | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    const unsub = subscribeAnalysis(id, (d) => {
      setRec(d);
      setLoaded(true);
      // Seed the editable copy exactly once from whatever the first snapshot
      // carries — a ref (not the `model` state) avoids a stale closure here,
      // since this callback is created once and never sees later state.
      if (d?.result?.study?.model && !initialized.current) {
        initialized.current = true;
        setModel(structuredClone(d.result.study.model));
      }
    });
    return () => unsub();
  }, [id]);

  const cur = model?.currency ?? "USD";
  const f = (v: number) => money(v, cur);

  const preview = useMemo(() => {
    if (!model || !rec?.input) return null;
    const parsed = FinancialModelSchema.safeParse(model);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid model" };
    try {
      const p = buildProjections(parsed.data, {
        monthlyCost: Number(rec.input.monthly_cost) || 0,
        monthlyRevenue: Number(rec.input.monthly_revenue) || 0,
      });
      return { projections: p };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not compute projections" };
    }
  }, [model, rec]);

  if (!loaded || !user) return <div className="py-20 text-center text-sm text-muted">Loading…</div>;

  if (!rec || !rec.result?.study) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h2 className="font-display text-lg font-semibold">No financial study to edit</h2>
        <Button href={`/app/analysis/${id}`} variant="ghost" className="mt-5">Back to report</Button>
      </div>
    );
  }

  const isOwner = rec.uid === user.uid;
  if (!isOwner && user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h2 className="font-display text-lg font-semibold">Not your analysis</h2>
        <Button href="/app" variant="ghost" className="mt-5">Dashboard</Button>
      </div>
    );
  }

  if (!model) return <div className="py-20 text-center text-sm text-muted">Loading…</div>;

  function set<K extends keyof FinancialModel>(key: K, value: FinancialModel[K]) {
    setModel((m) => (m ? { ...m, [key]: value } : m));
  }
  function setAssumption<K extends keyof FinancialModel["assumptions"]>(key: K, value: FinancialModel["assumptions"][K]) {
    setModel((m) => (m ? { ...m, assumptions: { ...m.assumptions, [key]: value } } : m));
  }
  function setFunding<K extends keyof FinancialModel["funding"]>(key: K, value: FinancialModel["funding"][K]) {
    setModel((m) => (m ? { ...m, funding: { ...m.funding, [key]: value } } : m));
  }

  async function save() {
    if (!model) return;
    setError("");
    const parsed = FinancialModelSchema.safeParse(model);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      await saveFinancialModel(id, parsed.data);
      router.push(`/app/analysis/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const fundingSum = model.funding.equity_percent + model.funding.debt_percent + model.funding.owner_capital_percent;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => router.push(`/app/analysis/${id}`)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <Icon name="arrow" size={16} className="rotate-180" /> Back to report
        </button>
        <Badge tone="warn"><Icon name="sliders" size={13} /> Editing financial model</Badge>
      </div>

      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Edit financial model</h1>
        <p className="mt-1 text-sm text-muted">
          Adjust the CapEx, OpEx, revenue and funding assumptions the AI generated. Every number below recomputes
          instantly as a preview; nothing is saved until you click Save & recompute.
        </p>
      </div>

      {/* Live preview */}
      <div className="card p-5">
        <div className="label mb-3">Live preview</div>
        {preview?.error ? (
          <p className="text-sm text-stop">{preview.error}</p>
        ) : preview?.projections ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PreviewTile label="Total capital required" value={f(preview.projections.funding.total)} />
            <PreviewTile label="NPV" value={f(preview.projections.returns.npv)} tone={preview.projections.returns.npv >= 0 ? "go" : "stop"} />
            <PreviewTile label="IRR" value={preview.projections.returns.irrPercent === null ? "n/a" : `${preview.projections.returns.irrPercent}%`} />
            <PreviewTile label="Payback" value={preview.projections.returns.paybackMonths === null ? "Beyond horizon" : `${preview.projections.returns.paybackMonths} mo`} />
          </div>
        ) : null}
      </div>

      {/* CapEx */}
      <ArraySection
        title="Capital Expenditure (CapEx)"
        rows={model.capex}
        onChange={(rows) => set("capex", rows)}
        newRow={(): CapexItem => ({ category: "Other", item: "New item", amount: 0, basis: "Manual edit", depreciable: false })}
        columns={[
          { key: "category", label: "Category", type: "text" },
          { key: "item", label: "Item", type: "text", wide: true },
          { key: "amount", label: `Amount (${cur})`, type: "number" },
          { key: "depreciable", label: "Depreciable", type: "bool" },
          { key: "basis", label: "Basis", type: "text", wide: true },
        ]}
      />

      {/* OpEx */}
      <ArraySection
        title="Operating Expenditure (OpEx)"
        rows={model.opex}
        onChange={(rows) => set("opex", rows)}
        newRow={(): OpexItem => ({ category: "Other", item: "New item", monthly_amount: 0, basis: "Manual edit", variable_with_revenue: false })}
        columns={[
          { key: "category", label: "Category", type: "text" },
          { key: "item", label: "Item", type: "text", wide: true },
          { key: "monthly_amount", label: `Monthly (${cur})`, type: "number" },
          { key: "variable_with_revenue", label: "Variable", type: "bool" },
          { key: "basis", label: "Basis", type: "text", wide: true },
        ]}
      />

      {/* Revenue streams */}
      <ArraySection
        title="Revenue Streams"
        rows={model.revenue_streams}
        onChange={(rows) => set("revenue_streams", rows)}
        newRow={(): RevenueStream => ({
          name: "New stream", unit_label: "units/month", units_per_month: 0, price_per_unit: 0,
          utilization_percent: 100, cogs_percent: 0, ramp_months: 0, basis: "Manual edit",
        })}
        columns={[
          { key: "name", label: "Stream", type: "text" },
          { key: "unit_label", label: "Unit", type: "text" },
          { key: "units_per_month", label: "Vol/month", type: "number" },
          { key: "price_per_unit", label: `Price (${cur})`, type: "number" },
          { key: "utilization_percent", label: "Utilisation %", type: "number" },
          { key: "cogs_percent", label: "COGS %", type: "number" },
          { key: "ramp_months", label: "Ramp (mo)", type: "number" },
        ]}
      />

      {/* Assumptions */}
      <div className="card space-y-4 p-5">
        <div className="label">Key assumptions</div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumField label="Projection years" value={model.assumptions.projection_years} onChange={(v) => setAssumption("projection_years", Math.min(5, Math.max(3, Math.round(v))))} />
          <NumField label="Cost inflation %/yr" value={model.assumptions.cost_inflation_percent} onChange={(v) => setAssumption("cost_inflation_percent", v)} />
          <NumField label="Discount rate %" value={model.assumptions.discount_rate_percent} onChange={(v) => setAssumption("discount_rate_percent", v)} />
          <NumField label="Tax rate %" value={model.assumptions.tax_rate_percent} onChange={(v) => setAssumption("tax_rate_percent", v)} />
          <NumField label="Depreciation (years)" value={model.assumptions.depreciation_years} onChange={(v) => setAssumption("depreciation_years", v)} />
          <NumField label="Working capital (months)" value={model.assumptions.working_capital_months} onChange={(v) => setAssumption("working_capital_months", v)} />
        </div>
      </div>

      {/* Funding */}
      <div className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div className="label">Funding structure</div>
          <span className={cn("text-xs", Math.round(fundingSum) === 100 ? "text-go" : "text-stop")}>
            {Math.round(fundingSum)}% allocated {Math.round(fundingSum) !== 100 && "(should total 100%)"}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumField label="Equity %" value={model.funding.equity_percent} onChange={(v) => setFunding("equity_percent", v)} />
          <NumField label="Debt %" value={model.funding.debt_percent} onChange={(v) => setFunding("debt_percent", v)} />
          <NumField label="Owner capital %" value={model.funding.owner_capital_percent} onChange={(v) => setFunding("owner_capital_percent", v)} />
          <NumField label="Debt interest %" value={model.funding.debt_interest_percent} onChange={(v) => setFunding("debt_interest_percent", v)} />
          <NumField label="Debt term (years)" value={model.funding.debt_term_years} onChange={(v) => setFunding("debt_term_years", v)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-faint">Structure rationale</label>
          <textarea className="input min-h-[60px] resize-y" value={model.funding.structure_rationale} onChange={(e) => setFunding("structure_rationale", e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-stop">{error}</p>}

      <div className="flex items-center justify-between pb-8">
        <Button variant="ghost" onClick={() => router.push(`/app/analysis/${id}`)}>Cancel</Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : <>Save &amp; recompute <Icon name="check" size={16} /></>}
        </Button>
      </div>
    </div>
  );
}

function PreviewTile({ label, value, tone }: { label: string; value: string; tone?: "go" | "stop" }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="text-[0.7rem] text-faint">{label}</div>
      <div className={cn("num mt-0.5 text-lg font-semibold", tone === "go" ? "text-go" : tone === "stop" ? "text-stop" : "")}>{value}</div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-faint">{label}</label>
      <input className="input" type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

type Col<T> = { key: keyof T; label: string; type: "text" | "number" | "bool"; wide?: boolean };

function ArraySection<T extends Record<string, any>>({
  title,
  rows,
  onChange,
  newRow,
  columns,
}: {
  title: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  newRow: () => T;
  columns: Col<T>[];
}) {
  function updateRow(i: number, key: keyof T, value: unknown) {
    const next = rows.slice();
    next[i] = { ...next[i], [key]: value };
    onChange(next);
  }
  function removeRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="label">{title}</div>
        <button type="button" onClick={() => onChange([...rows, newRow()])} className="btn btn-ghost text-xs">
          <Icon name="plus" size={13} /> Add row
        </button>
      </div>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-faint">No items — add one above.</p>}
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface-2 p-3">
            {columns.map((col) => (
              <div key={String(col.key)} className={col.wide ? "min-w-[10rem] flex-1" : "w-28"}>
                <label className="mb-1 block text-[0.65rem] text-faint">{col.label}</label>
                {col.type === "bool" ? (
                  <input
                    type="checkbox"
                    checked={!!row[col.key]}
                    onChange={(e) => updateRow(i, col.key, e.target.checked)}
                    className="h-5 w-5 accent-brand"
                  />
                ) : (
                  <input
                    className="input text-sm"
                    type={col.type === "number" ? "number" : "text"}
                    value={row[col.key] as any}
                    onChange={(e) => updateRow(i, col.key, col.type === "number" ? Number(e.target.value) : e.target.value)}
                  />
                )}
              </div>
            ))}
            <button type="button" onClick={() => removeRow(i)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-faint hover:text-stop" aria-label="Remove row">
              <Icon name="x" size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
