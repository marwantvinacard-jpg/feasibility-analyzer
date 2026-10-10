// Size limits for everything a user can send into an analysis. Shared by the
// server-side validator (lib/engine/validateInput.ts) and the New Analysis form,
// so the form's maxLength never lets through something the server rejects.
//
// Why these matter: the whole input is pasted into ~12 AI prompts per run, and
// stored twice on the analysis doc (Firestore's hard cap is 1 MiB). Without a
// server-side cap, one oversized request costs dollars in tokens and then fails
// on save — refunding the credit, so it can be repeated for free.

export const TEXT_LIMITS = {
  business_idea: 2000,
  target_customer: 1500,
  location: 200,
  problem_solved: 2000,
  product_service: 2000,
  revenue_model: 1500,
  competitors: 1500,
  unique_advantage: 1500,
  funding_preference: 500,
  study_protocol: 2000,
  client_name: 200,
  business_type: 64,
  /** Text pulled from uploaded documents — matches the ingest route's cap. */
  knowledge_base: 20_000,
} as const;

/** Largest money amount accepted (monthly cost/revenue, capex budget). */
export const MAX_AMOUNT = 1_000_000_000_000;

/** The free-text "describe your business" box that feeds /api/extract. */
export const MAX_DESCRIBE_CHARS = 8000;

/** Hard cap on a raw request body, checked before JSON parsing. Comfortably
 *  above the sum of every field limit above, far below Firestore's 1 MiB. */
export const MAX_BODY_BYTES = 100_000;

/** Upload cap for /api/ingest. Vercel rejects request bodies over 4.5 MB
 *  before the route runs, so anything higher would never give a clear error. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
