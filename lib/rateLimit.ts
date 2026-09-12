// Lightweight in-memory sliding-window rate limiter. Good enough for a single
// server instance; on a multi-instance serverless deployment each instance
// keeps its own counters, so the effective global limit is (limit × instance
// count) rather than a hard global cap. That's an acceptable first layer of
// defense-in-depth on top of the credit-balance cap that already bounds total
// cost exposure — for a hard global guarantee under real multi-instance load,
// swap this map for Upstash Redis (`@upstash/ratelimit`) using the same
// `check()` call shape.

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

// Periodically forget stale buckets so this doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (now - b.windowStart > 10 * 60_000) buckets.delete(key);
  }
}, 5 * 60_000).unref?.();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/** `key` should identify the caller (e.g. an API key id or uid) — never the raw secret. */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: windowMs - (now - existing.windowStart) };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfterMs: 0 };
}
