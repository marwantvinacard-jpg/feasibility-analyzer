import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep these server-only packages OUT of the webpack bundle so Node resolves
  // their real (nested) dependencies at runtime. firebase-admin in particular
  // must be external, or bundling flattens jwks-rsa→jose into an ESM/CJS clash
  // (ERR_REQUIRE_ESM) that crashes the API routes.
  serverExternalPackages: ["openai", "pdf-parse", "firebase-admin"],
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
