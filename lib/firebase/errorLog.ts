// Server-side error visibility: written to Firestore (queryable from the admin
// panel) and, when NEXT_PUBLIC_SENTRY_DSN is set, reported to Sentry too.
import * as Sentry from "@sentry/nextjs";
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
  Sentry.captureException(err, { tags: { context }, extra: meta });
  // Still surface it in the server's own logs (Vercel/Cloud Run capture stdout).
  console.error(`[${context}]`, err);
}
