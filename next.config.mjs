import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep these server-only packages OUT of the webpack bundle so Node resolves
  // their real (nested) dependencies at runtime. firebase-admin in particular
  // must be external, or bundling flattens jwks-rsa→jose into an ESM/CJS clash
  // (ERR_REQUIRE_ESM) that crashes the API routes.
  serverExternalPackages: ["openai", "pdf-parse", "firebase-admin"],
  // CSP is shipped as Content-Security-Policy-REPORT-ONLY, not enforced: every
  // third-party origin below (Firebase Auth/Firestore, Stripe's server SDK,
  // PostHog, Sentry) is all that should be needed per an audit of this repo's
  // actual client-side calls, but a report-only rollout means a wrong entry
  // shows up as a console/DevTools violation instead of silently breaking
  // sign-in or payment. Check the browser console (and Sentry, if a
  // report-uri is wired up) across a real login + checkout + analysis run for
  // a few days, then switch the header key below to the enforcing name.
  async headers() {
    const csp = [
      "default-src 'self'",
      // Next.js's own hydration bootstrap is inline; a nonce-based policy is
      // the stricter alternative but needs per-request middleware to set up.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firestore.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://us.i.posthog.com https://*.ingest.sentry.io https://*.sentry.io",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  // Source map upload only runs when SENTRY_AUTH_TOKEN is set (e.g. in CI/Vercel);
  // local dev builds skip it automatically.
  widenClientFileUpload: true,
  webpack: {
    removeDebugLogging: true,
    automaticVercelMonitors: true,
  },
});
