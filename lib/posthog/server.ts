import { PostHog } from "posthog-node";

let client: PostHog | null = null;

/** Returns null (no-op) when NEXT_PUBLIC_POSTHOG_KEY isn't set. */
export function posthogServer(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1, // serverless: flush immediately, the process may not stay alive
      flushInterval: 0,
    });
  }
  return client;
}

/** Fire-and-forget server-side event capture. Never throws. */
export function captureServerEvent(distinctId: string, event: string, properties?: Record<string, unknown>) {
  try {
    posthogServer()?.capture({ distinctId, event, properties });
  } catch {
    /* analytics must never break the request */
  }
}

/** Evaluate a feature flag server-side (e.g. to gate an API route's behavior). */
export async function getServerFeatureFlag(distinctId: string, key: string): Promise<boolean | string | undefined> {
  try {
    return await posthogServer()?.getFeatureFlag(key, distinctId);
  } catch {
    return undefined;
  }
}
