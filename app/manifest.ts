import type { MetadataRoute } from "next";

// Makes the app installable (Chrome/Edge "Install app", Android "Add to Home
// screen"). iOS's install path reads apple-icon.tsx directly, not this file.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FeasibilityAI",
    short_name: "FeasibilityAI",
    description: "Turn a business idea into a professional 8-dimension feasibility report with a clear GO / NO-GO verdict.",
    start_url: "/app",
    display: "standalone",
    background_color: "#faf9f6",
    theme_color: "#264DF0",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
