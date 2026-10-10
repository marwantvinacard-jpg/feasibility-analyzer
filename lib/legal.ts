// ⚠️ FILL THESE IN BEFORE LAUNCH. The Terms and Privacy pages (/terms,
// /privacy) and the signup consent read everything from here. Until every
// field is filled in, both pages show a visible "placeholders" warning.
//
// Have a lawyer review the pages once filled in — especially the governing
// law and whether "feasibility study" is a regulated term where you operate.

export const LEGAL = {
  /** The registered company that users contract with, e.g. "FeasibilityAI Ltd". */
  companyName: "[COMPANY LEGAL NAME]",
  /** Registered address, one line. */
  address: "[REGISTERED ADDRESS]",
  /** Country/state whose law governs the Terms, e.g. "England and Wales". */
  governingLaw: "[GOVERNING LAW / JURISDICTION]",
  /** Where users send privacy and legal requests. Must be a real, monitored inbox. */
  contactEmail: "[PRIVACY CONTACT EMAIL]",
  /**
   * Bump this whenever the Terms or Privacy Policy change materially. It's
   * stored with each user's acceptance at signup (users.termsVersion).
   */
  version: "2026-09-26",
} as const;

export function legalPlaceholdersRemaining(): string[] {
  return Object.entries(LEGAL)
    .filter(([, v]) => typeof v === "string" && v.startsWith("["))
    .map(([k]) => k);
}
