// Minimal server-side error visibility until a real APM (Sentry, etc.) is
// wired in — that needs your own account/DSN, which I can't create for you.
// This at least means a production error doesn't disappear into a server log
// nobody reads: it's queryable from the admin panel's Firestore access.
import { adminDb } from "./admin";

export async function logError(context: string, err: unknown, meta?: Record<string, unknown>) {
  try {
    await adminDb()
      .collection("errorLog")
      .add({
        context,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack ?? null : null,
        meta: meta ?? null,
        createdAt: Date.now(),
      });
  } catch {
    /* logging must never itself throw and mask the original error */
  }
  // Still surface it in the server's own logs (Vercel/Cloud Run capture stdout).
  console.error(`[${context}]`, err);
}
