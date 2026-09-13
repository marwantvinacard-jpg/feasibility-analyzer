import { useEffect, useState } from "react";
import { posthog, isFeatureEnabled } from "../services/analytics";

/** Reactive PostHog feature flag. Re-renders when flags are (re)loaded. */
export function useFeatureFlag(flag: string): boolean {
  const [enabled, setEnabled] = useState(() => isFeatureEnabled(flag));

  useEffect(() => {
    return posthog.onFeatureFlags(() => {
      setEnabled(isFeatureEnabled(flag));
    });
  }, [flag]);

  return enabled;
}
