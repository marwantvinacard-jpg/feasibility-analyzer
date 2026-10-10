"use client";

// The visitor's choice about analytics cookies (PostHog). Nothing optional
// runs until they accept. Stored per browser; wrapped in try/catch because
// storage can be unavailable (private mode, blocked site data).

export type AnalyticsConsent = "granted" | "denied";
const KEY = "analytics-consent";
const EVENT = "analytics-consent-change";

export function getAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(v: AnalyticsConsent): void {
  try {
    window.localStorage.setItem(KEY, v);
  } catch {
    /* the choice still applies for this page view */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: v }));
}

export function onAnalyticsConsentChange(cb: (v: AnalyticsConsent) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<AnalyticsConsent>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** Only ask when there's something optional to consent to. */
export const analyticsConfigured = () => !!process.env.NEXT_PUBLIC_POSTHOG_KEY;
