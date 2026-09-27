import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://feasibility-analyzer-eight.vercel.app";

// Only the public, unauthenticated pages — everything under /app is
// per-account and behind auth, so it has no business in a public sitemap.
const PUBLIC_ROUTES = ["", "/login", "/signup", "/methodology", "/sample-report"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((path) => ({
    url: `${APP_URL}${path}`,
    lastModified: new Date(),
  }));
}
