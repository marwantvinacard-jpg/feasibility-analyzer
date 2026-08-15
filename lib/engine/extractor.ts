// Field extraction + completeness gate. Ports the n8n "Master Orchestrator"
// (LLM extraction) + "Data Validator" (merge + completeness) nodes. In the web
// app the guided form usually supplies the 10 fields directly; this path is
// used by the optional "just describe your business" box that pre-fills them,
// and by the follow-up loop that merges answers across turns.

import type { LlmProvider } from "./provider";
import { ExtractionSchema } from "./schemas";
import { EXTRACTOR_PROMPT } from "./prompts";
import {
  ALL_FIELDS,
  FIELD_LABELS,
  type BusinessInput,
  type ExtractionResult,
} from "./types";

export const COMPLETENESS_THRESHOLD = 70;
const NUMERIC = new Set(["monthly_cost", "monthly_revenue"]);

function realText(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 3 && v !== "DATA_NEEDED";
}
function realNumber(v: unknown): boolean {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && !Number.isNaN(n) && n > 0;
}

/** Merge new extraction over previous (new non-empty values win). */
function merge(prev: Record<string, unknown>, next: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...prev };
  for (const f of ALL_FIELDS) {
    const nv = next[f];
    const isReal = NUMERIC.has(f) ? realNumber(nv) : realText(nv);
    if (isReal) out[f] = NUMERIC.has(f) ? Number(nv) : nv;
    else if (out[f] === undefined) out[f] = nv;
  }
  return out;
}

export function computeCompleteness(data: Record<string, unknown>): ExtractionResult {
  const missing: string[] = [];
  let provided = 0;
  for (const f of ALL_FIELDS) {
    const ok = NUMERIC.has(f) ? realNumber(data[f]) : realText(data[f]);
    if (ok) provided++;
    else missing.push(f);
  }
  const completeness = Math.round((provided / ALL_FIELDS.length) * 100);
  return {
    data: coerce(data),
    completeness,
    missingFields: missing,
    missingFieldsReadable: missing.map((f) => FIELD_LABELS[f] ?? f),
    isComplete: completeness >= COMPLETENESS_THRESHOLD,
  };
}

/** Coerce a loose record into a Partial<BusinessInput> with numeric fields. */
function coerce(data: Record<string, unknown>): Partial<BusinessInput> {
  const out: Partial<BusinessInput> = {};
  for (const f of ALL_FIELDS) {
    const v = data[f];
    if (v === undefined) continue;
    if (NUMERIC.has(f)) {
      if (realNumber(v)) (out as any)[f] = Number(v);
    } else if (realText(v)) {
      (out as any)[f] = v;
    }
  }
  return out;
}

/**
 * Extract the 10 fields from free text and report completeness. `previous`
 * carries forward data already collected in earlier turns of the follow-up loop.
 */
export async function extractFromText(
  provider: LlmProvider,
  text: string,
  previous: Partial<BusinessInput> = {}
): Promise<ExtractionResult> {
  const { data } = await provider.structured({
    system: EXTRACTOR_PROMPT,
    user: `Extract the 10 business data points from this input:\n\n${text}`,
    schema: ExtractionSchema,
    schemaName: "extraction",
    model: process.env.FEASIBILITY_EXTRACT_MODEL,
    mockValue: mockExtract(text, previous),
  });
  const merged = merge(previous as Record<string, unknown>, data as Record<string, unknown>);
  return computeCompleteness(merged);
}

/** Mock extraction: keep whatever was already provided, mark the rest needed. */
function mockExtract(_text: string, previous: Partial<BusinessInput>) {
  const base: Record<string, string | number> = {};
  for (const f of ALL_FIELDS) {
    const v = (previous as Record<string, unknown>)[f];
    if (NUMERIC.has(f)) base[f] = realNumber(v) ? Number(v) : "DATA_NEEDED";
    else base[f] = realText(v) ? String(v) : "DATA_NEEDED";
  }
  return base;
}

/** True when every one of the 10 fields is satisfactorily filled. */
export function isFullyComplete(input: Partial<BusinessInput>): boolean {
  return computeCompleteness(input as Record<string, unknown>).missingFields.length === 0;
}
