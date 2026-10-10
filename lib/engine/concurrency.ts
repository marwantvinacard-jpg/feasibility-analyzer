// Limits how many AI calls run at once, and retries the ones the provider
// turns away for rate limiting.
//
// Every analysis fires ~10 model calls at the same moment. Several analyses
// starting together multiply that, and the provider starts answering 429
// ("slow down") — which used to make whole report sections fail quietly.
//
// Scope: the limiter is per server instance (it's in memory). On Vercel with
// Fluid compute one instance serves many concurrent requests, so this smooths
// bursts from analyses sharing an instance; a hard GLOBAL cap across all
// instances needs a shared store (e.g. Upstash Redis, see lib/rateLimit.ts).

import type { LlmProvider, StructuredCall, StructuredResult } from "./provider";

/** FIFO counting semaphore. A released slot is handed straight to the next waiter. */
export class Semaphore {
  private active = 0;
  private waiters: (() => void)[] = [];

  constructor(readonly capacity: number) {
    if (!(capacity >= 1)) throw new Error("Semaphore capacity must be at least 1");
  }

  get inUse(): number {
    return this.active;
  }
  get waiting(): number {
    return this.waiters.length;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active < this.capacity) this.active++;
    else await new Promise<void>((resolve) => this.waiters.push(resolve)); // slot is handed over on release
    try {
      return await fn();
    } finally {
      const next = this.waiters.shift();
      if (next) next();
      else this.active--;
    }
  }
}

const envInt = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
};

/** Shared by every analysis on this server instance. */
export const llmLimiter = new Semaphore(envInt("FEASIBILITY_LLM_MAX_CONCURRENCY", 10));

/** Wraps a provider so each call waits for a free slot in `limiter`. */
export function withConcurrencyLimit(provider: LlmProvider, limiter: Semaphore = llmLimiter): LlmProvider {
  return {
    get mock() {
      return provider.mock;
    },
    get model() {
      return provider.model;
    },
    structured<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
      return limiter.run(() => provider.structured(call));
    },
  };
}

/** True for a provider "too many requests" error (OpenAI-compatible SDKs set status 429). */
export function isRateLimited(err: unknown): boolean {
  const e = err as { status?: number; code?: string } | null;
  return e?.status === 429 || e?.code === "rate_limit_exceeded";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One extra attempt, after a short randomised pause, when a call is still
 * rate-limited after the SDK's own retries. The pause spreads out the retries
 * of calls that were all turned away together.
 */
export async function retryIfRateLimited<T>(fn: () => Promise<T>, pauseMs = () => 2000 + Math.random() * 4000): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isRateLimited(err)) throw err;
    await sleep(pauseMs());
    return fn();
  }
}
