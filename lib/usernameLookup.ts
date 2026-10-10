// Server-side username -> account lookup (Admin SDK). The email comes from
// Firebase Auth itself, never from the (public) usernames doc.
import { adminAuth, adminDb } from "./firebase/admin";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export async function accountForUsername(raw: unknown): Promise<{ uid: string; email: string; name?: string } | null> {
  if (typeof raw !== "string") return null;
  const username = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) return null;
  const snap = await adminDb().collection("usernames").doc(username).get();
  const uid = snap.data()?.uid as string | undefined;
  if (!uid) return null;
  const user = await adminAuth().getUser(uid).catch(() => null);
  if (!user?.email) return null;
  return { uid, email: user.email, name: user.displayName ?? undefined };
}

/** Best-effort caller address for rate limiting (first hop of X-Forwarded-For). */
export function clientAddress(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}
