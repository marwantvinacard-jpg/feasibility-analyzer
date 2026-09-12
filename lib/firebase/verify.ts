// Server-side auth verification for API routes. Reads the Firebase ID token
// from the Authorization: Bearer header and verifies it with the Admin SDK.
import { adminAuth } from "./admin";

export interface Caller {
  uid: string;
  email?: string;
  admin: boolean;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export { HttpError };

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
    return { uid: decoded.uid, email: decoded.email, admin: decoded.admin === true };
  } catch {
    throw new HttpError(401, "Invalid or expired session.");
  }
}

export async function requireAdmin(req: Request): Promise<Caller> {
  const caller = await requireUser(req);
  if (!caller.admin) throw new HttpError(403, "Admins only.");
  return caller;
}
