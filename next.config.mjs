/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The engine imports the `openai` SDK on the server only.
  serverExternalPackages: ["openai"],
};

export default nextConfig;
