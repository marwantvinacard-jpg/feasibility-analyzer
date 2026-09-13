import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN;
const ENV = import.meta.env.VITE_APP_ENV || import.meta.env.MODE;

let initialized = false;

/** Boots Sentry's browser SDK once. No-ops when no DSN is configured. */
export function initMonitoring() {
  if (initialized || !DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: ENV,
    tracesSampleRate: ENV === "production" ? 0.1 : 1.0,
  });
  initialized = true;
}

export function setMonitoringUser(uid: string, email?: string) {
  if (!initialized) return;
  Sentry.setUser({ id: uid, email });
}

export function clearMonitoringUser() {
  if (!initialized) return;
  Sentry.setUser(null);
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  console.error(error);
  if (!initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
