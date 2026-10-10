// Server-side validation for analysis input. Every route that runs the engine
// must pass the request through here BEFORE charging a credit or calling a
// model — the browser's limits are a convenience, not a control.

import { z } from "zod";
import { FIELD_LABELS, type BusinessInput } from "./types";
import { MAX_AMOUNT, MAX_BODY_BYTES, TEXT_LIMITS } from "./inputLimits";

const text = (field: keyof typeof TEXT_LIMITS) => z.string().max(TEXT_LIMITS[field]);
const amount = z.number().finite().min(0).max(MAX_AMOUNT);

export const BusinessInputSchema = z
  .object({
    business_idea: text("business_idea").refine((s) => s.trim().length > 0, "is required"),
    target_customer: text("target_customer").default(""),
    location: text("location").default(""),
    problem_solved: text("problem_solved").default(""),
    product_service: text("product_service").default(""),
    revenue_model: text("revenue_model").default(""),
    competitors: text("competitors").default(""),
    unique_advantage: text("unique_advantage").default(""),
    monthly_cost: amount.default(0),
    monthly_revenue: amount.default(0),
    currency: z.string().regex(/^[A-Z]{3,8}$/, "must be a currency code like USD").optional(),
    projection_years: z.number().int().min(3).max(5).optional(),
    capex_budget: amount.optional(),
    funding_preference: text("funding_preference").optional(),
    knowledge_base: text("knowledge_base").optional(),
    business_type: text("business_type").optional(),
    study_protocol: text("study_protocol").optional(),
    report_language: z.enum(["en", "ar", "fr"]).optional(),
    client_name: text("client_name").optional(),
  })
  // Unknown fields are dropped, not stored or sent to the model.
  .strip();

const LABELS: Record<string, string> = {
  ...FIELD_LABELS,
  knowledge_base: "Uploaded document text",
  study_protocol: "Study instructions",
  funding_preference: "Funding preference",
  client_name: "Client name",
  business_type: "Business type",
  capex_budget: "Setup budget",
  projection_years: "Projection years",
  report_language: "Report language",
  currency: "Currency",
};

function describeIssue(issue: z.ZodIssue): string {
  const field = String(issue.path[0] ?? "input");
  const label = LABELS[field] ?? field;
  if (issue.code === "too_big" && issue.type === "string") {
    return `${label} is too long (max ${Number(issue.maximum).toLocaleString("en-US")} characters).`;
  }
  if (issue.code === "too_big") return `${label} must be at most ${Number(issue.maximum).toLocaleString("en-US")}.`;
  if (issue.code === "too_small") {
    return Number(issue.minimum) === 0 ? `${label} can't be negative.` : `${label} must be at least ${issue.minimum}.`;
  }
  if (issue.code === "invalid_type") {
    return issue.received === "undefined" ? `${label} is required.` : `${label} must be a ${issue.expected}.`;
  }
  return `${label} ${issue.message}.`;
}

export type ValidationResult =
  | { ok: true; input: BusinessInput }
  | { ok: false; status: number; error: string };

export function validateBusinessInput(raw: unknown): ValidationResult {
  const parsed = BusinessInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 400, error: describeIssue(parsed.error.issues[0]) };
  }
  return { ok: true, input: parsed.data as BusinessInput };
}

/**
 * Reads a JSON request body with a hard size cap, checked on the raw bytes
 * before parsing — so an oversized payload is rejected without being parsed.
 */
export async function readJsonBody(
  req: Request,
  maxBytes = MAX_BODY_BYTES
): Promise<{ ok: true; body: any } | { ok: false; status: number; error: string }> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { ok: false, status: 413, error: "Request is too large." };
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) return { ok: false, status: 413, error: "Request is too large." };
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false, status: 400, error: "Request body must be valid JSON." };
  }
}
