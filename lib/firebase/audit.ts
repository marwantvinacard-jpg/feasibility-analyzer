// Append-only audit log (server-only). One entry per privileged or notable
// action, so "who did what, when" survives beyond memory — the baseline any
// financial decision-maker expects before trusting a number.
import { adminDb } from "./admin";

export interface AuditEntry {
  uid: string;
  email?: string;
  action: string; // e.g. "analysis.run", "analysis.review", "user.approve", "credits.grant"
  target?: string; // an analysis id, a user uid, etc.
  meta?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await adminDb()
      .collection("auditLog")
      .add({ ...entry, createdAt: Date.now() });
  } catch {
    /* never let audit logging break the primary action */
  }
}
