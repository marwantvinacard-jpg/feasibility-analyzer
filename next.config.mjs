import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep these server-only packages OUT of the webpack bundle so Node resolves
  // their real (nested) dependencies at runtime. firebase-admin in particular
  // must be external, or bundling flattens jwks-rsa→jose into an ESM/CJS clash
  // (ERR_REQUIRE_ESM) that crashes the API routes.
  serverExternalPackages: ["openai", "pdf-parse", "firebase-admin"],
  // Enforced. Verified zero violations across a production build (next build
  // + next start, not dev mode — dev's eval-based devtool trips 'unsafe-eval'
  // on its own and isn't representative) covering the public pages, login,
  // signup, and the authenticated dashboard/settings with live Firestore
  // calls. Payment (Stripe Checkout/webhook) is server-only in this app —
  // nothing client-side to violate — but re-check after any change that
  // loads a new third-party script or connects to a new origin.
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
          { key: "Content-Security-Policy", value: csp },
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
