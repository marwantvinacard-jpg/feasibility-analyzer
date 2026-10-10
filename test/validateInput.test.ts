import { test } from "node:test";
import assert from "node:assert/strict";
import { readJsonBody, validateBusinessInput } from "@/lib/engine/validateInput";
import { MAX_BODY_BYTES, TEXT_LIMITS } from "@/lib/engine/inputLimits";

// What the New Analysis form actually sends.
const formPayload = {
  business_idea: "Specialty coffee kiosk",
  target_customer: "Office workers",
  location: "Tunis, Tunisia",
  problem_solved: "No good coffee near the business district",
  product_service: "Espresso drinks and pastries",
  revenue_model: "Per-cup sales",
  competitors: "Local cafes",
  monthly_cost: 4000,
  monthly_revenue: 7000,
  unique_advantage: "Fastest service in the district",
  currency: "USD",
  projection_years: 5,
  business_type: "",
  study_protocol: "",
  report_language: "fr",
  knowledge_base: "### plan.pdf\nsome text",
};

const errorOf = (input: unknown) => {
  const r = validateBusinessInput(input);
  assert.equal(r.ok, false, "expected validation to fail");
  return (r as { error: string }).error;
};

test("validateBusinessInput: a normal form submission passes unchanged", () => {
  const r = validateBusinessInput(formPayload);
  assert.equal(r.ok, true);
  assert.deepEqual((r as { input: unknown }).input, formPayload);
});

test("validateBusinessInput: text at exactly the limit passes, one over fails with a clear message", () => {
  const max = TEXT_LIMITS.business_idea;
  assert.equal(validateBusinessInput({ ...formPayload, business_idea: "x".repeat(max) }).ok, true);
  assert.equal(
    errorOf({ ...formPayload, business_idea: "x".repeat(max + 1) }),
    "Business Idea is too long (max 2,000 characters)."
  );
});

test("validateBusinessInput: oversized uploaded-document text is rejected", () => {
  assert.equal(
    errorOf({ ...formPayload, knowledge_base: "x".repeat(TEXT_LIMITS.knowledge_base + 1) }),
    "Uploaded document text is too long (max 20,000 characters)."
  );
});

test("validateBusinessInput: business idea is required and can't be blank", () => {
  const { business_idea, ...rest } = formPayload;
  assert.equal(errorOf(rest), "Business Idea is required.");
  assert.equal(errorOf({ ...formPayload, business_idea: "   " }), "Business Idea is required.");
});

test("validateBusinessInput: money fields must be real, non-negative numbers", () => {
  assert.equal(errorOf({ ...formPayload, monthly_cost: "68,000" }), "Monthly Operating Costs must be a number.");
  assert.equal(errorOf({ ...formPayload, monthly_revenue: -5 }), "Expected Monthly Revenue can't be negative.");
  assert.match(errorOf({ ...formPayload, capex_budget: 1e13 }), /Setup budget must be at most/);
});

test("validateBusinessInput: enums and codes are checked", () => {
  assert.match(errorOf({ ...formPayload, currency: "usd" }), /Currency must be a currency code/);
  assert.match(errorOf({ ...formPayload, projection_years: 10 }), /Projection years must be at most 5/);
  assert.match(errorOf({ ...formPayload, projection_years: 1 }), /Projection years must be at least 3/);
  assert.equal(validateBusinessInput({ ...formPayload, report_language: "de" }).ok, false);
});

test("validateBusinessInput: wrong types are rejected, not coerced", () => {
  assert.equal(errorOf({ ...formPayload, location: { nested: "object" } }), "Location (City, Country) must be a string.");
  assert.equal(validateBusinessInput("not an object").ok, false);
  assert.equal(validateBusinessInput(null).ok, false);
});

test("validateBusinessInput: unknown fields are dropped, not stored or sent to the model", () => {
  const r = validateBusinessInput({ ...formPayload, orgId: "someone-elses-org", injected: "x".repeat(50) });
  assert.equal(r.ok, true);
  const out = (r as unknown as { input: Record<string, unknown> }).input;
  assert.equal("orgId" in out, false);
  assert.equal("injected" in out, false);
});

test("validateBusinessInput: API callers that only send the idea get safe defaults, not 'undefined'", () => {
  const r = validateBusinessInput({ business_idea: "Bakery" });
  assert.equal(r.ok, true);
  const out = (r as unknown as { input: Record<string, unknown> }).input;
  assert.equal(out.location, "");
  assert.equal(out.monthly_cost, 0);
});

const post = (body: string) =>
  new Request("http://localhost/api/analyze", { method: "POST", body, headers: { "content-type": "application/json" } });

test("readJsonBody: rejects oversized bodies before parsing", async () => {
  const r = await readJsonBody(post(JSON.stringify({ input: { business_idea: "x".repeat(MAX_BODY_BYTES) } })));
  assert.deepEqual(r, { ok: false, status: 413, error: "Request is too large." });
});

test("readJsonBody: malformed JSON is a clean 400, not a server crash", async () => {
  const r = await readJsonBody(post("{not json"));
  assert.deepEqual(r, { ok: false, status: 400, error: "Request body must be valid JSON." });
});

test("readJsonBody: a normal body parses", async () => {
  const r = await readJsonBody(post(JSON.stringify({ input: formPayload })));
  assert.equal(r.ok, true);
});
