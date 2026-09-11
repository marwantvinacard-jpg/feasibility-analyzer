// Export-paywall exemption list. The three seeded local accounts (the
// platform's own admin + two test users) always get free export — everyone
// else pays the one-time per-study unlock price before downloading a PDF.
// Matched by email since these are fixed accounts; a real admin role also
// always bypasses.

const EXEMPT_EMAILS = ["sophie@feasibility.local", "tarek@feasibility.local", "marwan@feasibility.local"];

export const EXPORT_UNLOCK_PRICE_USD = 3000;

export function isExportExempt(user: { email?: string; role?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return !!user.email && EXEMPT_EMAILS.includes(user.email.toLowerCase());
}
