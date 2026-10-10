"use client";

// Error boundary for the signed-in app: a crash in one page shows this inside
// the app shell (navigation still works) instead of taking down everything.
import { ErrorScreen } from "@/components/ErrorScreen";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} homeHref="/app" />;
}
