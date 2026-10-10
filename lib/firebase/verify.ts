// Server-side auth verification for API routes. Reads the Firebase ID token
// from the Authorization: Bearer header and verifies it with the Admin SDK.
import { adminAuth, adminDb } from "./admin";
import { logError } from "./errorLog";

export interface Caller {
  uid: string;
  email?: string;
  /** From the verified ID token, not the user's Firestore doc. */
  emailVerified: boolean;
  admin: boolean;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export { HttpError };

const ROUTINE_TOKEN_ERRORS = new Set([
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/argument-error",
  "auth/invalid-argument",
  "auth/user-disabled",
  "auth/user-not-found",
]);

export async function requireUser(req: Request): Promise<Caller> {
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "Not signed in.");
  try {
    // checkRevoked:true costs one extra Identity Toolkit round-trip per call,
    // but it's what makes a rejected/disabled account's already-issued token
    // stop working immediately instead of staying valid until its natural
    // ~1h expiry — worth it for an app that gates paid access by approval.
    const decoded = await adminAuth().verifyIdToken(token, true);
    return { uid: decoded.uid, email: decoded.email, emailVerified: decoded.email_verified === true, admin: decoded.admin === true };
  } catch (err) {
    // The client only ever sees the generic message below — never leak
    // verification internals — but unexpected failures (e.g. Google's signing
    // keys couldn't be fetched) are logged so they're visible in errorLog/Sentry.
    // Expired, revoked or malformed tokens are routine traffic, and anyone can
    // send a junk token, so those aren't logged: one errorLog write per bad
    // request would flood the log and let a stranger run up Firestore writes.
    if (!ROUTINE_TOKEN_ERRORS.has((err as { code?: string }).code ?? "")) await logError("auth.verify", err);
    throw new HttpError(401, "Invalid or expired session.");
  }
}

/**
 * Signed in AND approved. For routes that spend money (AI calls, document
 * parsing): a fresh signup — or a throwaway account — must not be able to use
 * them before its account is approved.
 */
export async function requireApprovedUser(req: Request): Promise<Caller> {
  const caller = await requireUser(req);
  const snap = await adminDb().collection("users").doc(caller.uid).get();
  if (snap.data()?.status !== "approved") throw new HttpError(403, "Your account isn't approved yet.");
  return caller;
}

export async function requireAdmin(req: Request): Promise<Caller> {
  const caller = await requireUser(req);
  if (!caller.admin) throw new HttpError(403, "Admins only.");
  return caller;
}
