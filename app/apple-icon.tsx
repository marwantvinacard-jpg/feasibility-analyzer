import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icons need a real raster image (iOS doesn't accept the SVG
// favicon) — this renders the same compass mark and brand color as icon.svg.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#264DF0",
          borderRadius: 40,
        }}
      >
        <svg width="112" height="112" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="9.5" fill="none" stroke="#ffffff" strokeWidth="1.9" />
          <path d="m20.4 10.4-2.5 6.4-6.4 2.5 2.5-6.4z" fill="#ffffff" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
