"use client";

// Error boundary for the public pages (landing, login, signup…). The root
// layout and its providers stay mounted; global-error.tsx remains the last
// resort for a crash in the root layout itself.
import { ErrorScreen } from "@/components/ErrorScreen";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} homeHref="/" />;
}
