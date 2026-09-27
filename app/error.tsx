"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Mark } from "@/components/Brand";
import { Button } from "@/components/kit";

// Route-level boundary — catches a render/data error inside a page without
// tearing down the whole app shell the way app/global-error.tsx (root-layout
// failures only) does.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center">
      <Mark className="mb-5" />
      <h1 className="font-display text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        This has been reported. You can try again, or head back to the dashboard.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button href="/app" variant="ghost">
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
