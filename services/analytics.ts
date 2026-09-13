import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

let initialized = false;

/** Boots PostHog once. No-ops when no key is configured (e.g. local dev). */
export function initAnalytics() {
  if (initialized || !KEY) return;
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: "identified_only",
    capture_pageview: false, // AppRoot's routes call trackPageview explicitly instead.
  });
  initialized = true;
}

export function trackPageview(path: string) {
  if (!initialized) return;
  posthog.capture("$pageview", { $current_url: path });
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

/** Ties subsequent events to the signed-in user. Call on login/profile load. */
export function identifyUser(uid: string, traits?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.identify(uid, traits);
}

/** Clears the identified user. Call on logout. */
export function resetAnalytics() {
  if (!initialized) return;
  posthog.reset();
}

export function isFeatureEnabled(flag: string): boolean {
  if (!initialized) return false;
  return posthog.isFeatureEnabled(flag) ?? false;
}

export function getFeatureFlagPayload(flag: string): unknown {
  if (!initialized) return undefined;
  return posthog.getFeatureFlagPayload(flag);
}

export { posthog };
