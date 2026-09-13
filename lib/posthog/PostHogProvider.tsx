"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useSession } from "@/lib/session";
import { posthog, initPostHog } from "./client";

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
  const email = user?.email;

  useEffect(() => {
    if (!ph) return;
    if (uid) ph.identify(uid, email ? { email } : undefined);
    else ph.reset();
  }, [ph, uid, email]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

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
