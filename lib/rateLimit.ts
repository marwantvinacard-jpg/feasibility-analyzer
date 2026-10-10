// Rate limiting shared by EVERY server instance, stored in Firestore.
//
// It used to be an in-memory Map, so on a serverless/multi-instance host each
// instance counted separately and the real limit was (limit × instances) —
// effectively no limit under load. Now one counter per key per time window
// lives at rateLimits/{key}_{windowStart}, updated in a transaction, so all
// instances see the same count. Server-only (Admin SDK); the security rules
// deny all client access to rateLimits.
//
// Old windows are removed by a Firestore TTL policy on `expiresAt` (set up once:
// see scripts/setup-firebase-jobs.sh). If Firestore itself errors, the check
// lets the request through and logs it — a limiter outage must not take the
// whole app down with it.

import { adminDb } from "./firebase/admin";
import { logError } from "./firebase/errorLog";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/** Firestore doc ids can't contain "/"; keep them short and predictable. */
const docIdFor = (key: string, windowStart: number) => `${key.replace(/[\/\s]/g, "_").slice(0, 200)}_${windowStart}`;

/** `key` should identify the caller (e.g. "analyze:<uid>") — never a raw secret. */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const retryAfterMs = windowStart + windowMs - now;
  const db = adminDb();
  const ref = db.collection("rateLimits").doc(docIdFor(key, windowStart));
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = (snap.data()?.count as number | undefined) ?? 0;
      if (count >= limit) return { allowed: false, remaining: 0, retryAfterMs };
      tx.set(ref, { key, count: count + 1, expiresAt: new Date(windowStart + windowMs + 60 * 60_000) });
      return { allowed: true, remaining: limit - count - 1, retryAfterMs: 0 };
    });
  } catch (err) {
    await logError("rateLimit", err, { key }).catch(() => {});
    return { allowed: true, remaining: limit, retryAfterMs: 0 };
  }
}
