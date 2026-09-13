"use client";
import posthog from "posthog-js";

let initialized = false;

/** Idempotent — safe to call from multiple components. No-ops without a key. */
export function initPostHog() {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // captured manually on route change, see PostHogPageview
  });
  initialized = true;
}

export { posthog };
