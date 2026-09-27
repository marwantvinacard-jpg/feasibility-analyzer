import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://feasibility-analyzer-eight.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The authenticated app and its APIs have nothing for a crawler —
        // and Firestore-backed pages under /app are gated by auth anyway.
        disallow: ["/app/", "/api/", "/admin"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
