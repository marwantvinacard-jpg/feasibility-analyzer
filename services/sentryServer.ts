import * as Sentry from "@sentry/node";

const DSN = process.env.SENTRY_DSN;

/**
 * Boots the Node SDK once per process. No-ops when SENTRY_DSN isn't set
 * (local dev), same pattern as the frontend's services/monitoring.ts.
 * Must be called before createApp() so Sentry's instrumentation can wrap
 * Express route handlers.
 */
export function initServerMonitoring() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}

export const sentryEnabled = Boolean(DSN);
export { Sentry };
