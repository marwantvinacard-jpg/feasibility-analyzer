/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the OpenAI SDK out of the webpack bundle so Node resolves its real
  // (nested) deps at runtime.
  serverExternalPackages: ["openai", "pdf-parse"],
};

export default nextConfig;
