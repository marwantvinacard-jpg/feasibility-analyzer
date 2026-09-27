// Sliding-window rate limiter. Uses Upstash Redis over its REST API (plain
// fetch — no SDK, no new dependency) when UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set, giving a real global limit across every
// serverless instance. Without those set, falls back to the original
// in-memory map — correct for a single instance, but on a multi-instance
// deployment each instance keeps its own counters, so the effective global
// limit becomes (limit × instance count) rather than a hard cap. That's an
// acceptable first layer of defense-in-depth on top of the credit-balance cap
// that already bounds total cost exposure, but Upstash is the real fix.

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

function checkInMemory(key: string, limit: number, windowMs: number): RateLimitResult {
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

function upstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

/**
 * Fixed-window counter via Upstash's REST pipeline: INCR the window's key,
 * and on the first hit in that window, set its expiry. One round trip either
 * way. Falls back to in-memory (and never throws) if Upstash errors, so a
 * transient Upstash outage degrades to weaker limiting instead of blocking
 * every request.
 */
async function checkUpstash(
  cfg: { url: string; token: string },
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const windowSec = Math.ceil(windowMs / 1000);
  const bucketKey = `ratelimit:${key}:${Math.floor(Date.now() / windowMs)}`;
  const res = await fetch(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify([["INCR", bucketKey], ["EXPIRE", bucketKey, windowSec]]),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const [incrResult] = (await res.json()) as { result: number }[];
  const count = incrResult.result;
  if (count > limit) {
    return { allowed: false, remaining: 0, retryAfterMs: windowMs - (Date.now() % windowMs) };
  }
  return { allowed: true, remaining: limit - count, retryAfterMs: 0 };
}

/** `key` should identify the caller (e.g. an API key id or uid) — never the raw secret. */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const cfg = upstashConfig();
  if (!cfg) return checkInMemory(key, limit, windowMs);
  try {
    return await checkUpstash(cfg, key, limit, windowMs);
  } catch {
    return checkInMemory(key, limit, windowMs);
  }
}
