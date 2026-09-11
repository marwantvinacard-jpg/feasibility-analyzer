/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep these server-only packages OUT of the webpack bundle so Node resolves
  // their real (nested) dependencies at runtime. firebase-admin in particular
  // must be external, or bundling flattens jwks-rsa→jose into an ESM/CJS clash
  // (ERR_REQUIRE_ESM) that crashes the API routes.
  serverExternalPackages: ["openai", "pdf-parse", "firebase-admin"],
};

export default nextConfig;
