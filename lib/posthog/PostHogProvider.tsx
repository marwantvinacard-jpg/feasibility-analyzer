"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useSession } from "@/lib/session";
import { posthog, initPostHog } from "./client";
import { getAnalyticsConsent, onAnalyticsConsentChange } from "@/lib/consent";

function PostHogPageview() {
  const ph = usePostHog();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || !ph) return;
    const url = searchParams?.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
    ph.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}

/** Identifies the PostHog user once a session is known; resets on sign-out. */
function PostHogIdentify() {
  const ph = usePostHog();
  const { user } = useSession();
  const uid = user?.uid;

  // Identified by the internal account id only — analytics has no need for
  // the email address (it used to be sent with every session).
  useEffect(() => {
    if (!ph) return;
    if (uid) ph.identify(uid);
    else ph.reset();
  }, [ph, uid]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  // Analytics starts only after the visitor accepts analytics cookies
  // (components/CookieConsent.tsx). It used to start on every page load.
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (getAnalyticsConsent() === "granted") setEnabled(true);
    return onAnalyticsConsentChange((v) => {
      if (v === "granted") setEnabled(true);
      else if (posthog.__loaded) posthog.opt_out_capturing();
    });
  }, []);
  useEffect(() => {
    if (enabled) initPostHog();
  }, [enabled]);

  if (!enabled) return <>{children}</>;
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}

// Feature-flag usage elsewhere in the app:
//   import { useFeatureFlagEnabled } from "posthog-js/react";
//   const showNewThing = useFeatureFlagEnabled("new-thing");
