// Rate limiting shared by EVERY server instance.
//
// It used to be an in-memory Map, so on a serverless/multi-instance host each
// instance counted separately and the real limit was (limit × instances) —
// effectively no limit under load. Counters now live in one shared store:
//   - Upstash Redis (REST API, plain fetch — no SDK) when UPSTASH_REDIS_REST_URL
//     and UPSTASH_REDIS_REST_TOKEN are set: one round trip, the fastest option;
//   - otherwise Firestore: one counter per key per time window at
//     rateLimits/{key}_{windowStart}, updated in a transaction. Server-only
//     (Admin SDK); the security rules deny all client access to rateLimits.
//     Old windows are removed by a Firestore TTL policy on `expiresAt` (set up
//     once: see scripts/setup-firebase-jobs.sh).
// If Upstash errors, that request falls back to Firestore; if Firestore errors
// too, the request is let through and the failure logged — a limiter outage
// must not take the whole app down with it.

import { adminDb } from "./firebase/admin";
import { logError } from "./firebase/errorLog";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Where the counters live. `hit` records one request for `key` in the window
 * starting at `windowStart` and returns the window's count including it. A
 * store may stop counting once the count is past `limit`.
 */
export interface RateLimitStore {
  hit(key: string, windowStart: number, windowMs: number, limit: number): Promise<number>;
}

/** Firestore doc ids can't contain "/"; keep them short and predictable. */
const docIdFor = (key: string, windowStart: number) => `${key.replace(/[\/\s]/g, "_").slice(0, 200)}_${windowStart}`;

export const firestoreStore: RateLimitStore = {
  async hit(key, windowStart, windowMs, limit) {
    const db = adminDb();
    const ref = db.collection("rateLimits").doc(docIdFor(key, windowStart));
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = (snap.data()?.count as number | undefined) ?? 0;
      // Already over the limit: no write, so a flood of blocked calls costs reads only.
      if (count >= limit) return count + 1;
      tx.set(ref, { key, count: count + 1, expiresAt: new Date(windowStart + windowMs + 60 * 60_000) });
      return count + 1;
    });
  },
};

export function upstashStore(url: string, token: string): RateLimitStore {
  return {
    async hit(key, windowStart, windowMs) {
      const bucketKey = `ratelimit:${key}:${windowStart}`;
      const res = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        // Count the hit and (re)set the window's expiry in one round trip.
        body: JSON.stringify([["INCR", bucketKey], ["EXPIRE", bucketKey, Math.ceil(windowMs / 1000)]]),
        // A slow limiter mustn't hold up the request; Firestore takes over.
        signal: AbortSignal.timeout(2_000),
      });
      if (!res.ok) throw new Error(`Upstash ${res.status}`);
      const [incr] = (await res.json()) as { result?: unknown; error?: string }[];
      if (typeof incr?.result !== "number") throw new Error(`Upstash: ${incr?.error ?? "unexpected reply"}`);
      return incr.result;
    },
  };
}

function defaultStores(): RateLimitStore[] {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? [upstashStore(url, token), firestoreStore] : [firestoreStore];
}

/**
 * `key` should identify the caller AND the action (e.g. "analyze:<uid>"), so
 * one route's traffic doesn't use up another's allowance — never a raw secret.
 * `stores` is for tests; the app always uses the default.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  stores: RateLimitStore[] = defaultStores()
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const retryAfterMs = windowStart + windowMs - now;
  for (const store of stores) {
    try {
      const count = await store.hit(key, windowStart, windowMs, limit);
      if (count > limit) return { allowed: false, remaining: 0, retryAfterMs };
      return { allowed: true, remaining: limit - count, retryAfterMs: 0 };
    } catch (err) {
      await logError("rateLimit", err, { key }).catch(() => {});
    }
  }
  return { allowed: true, remaining: limit, retryAfterMs: 0 };
}
