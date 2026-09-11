import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  axes: ["opsz", "SOFT"],
});
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
// Arabic script isn't covered by Inter/Fraunces — this covers body + display
// text when the UI switches to Arabic (see globals.css [dir="rtl"] rules).
const notoArabic = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-sans-ar", display: "swap" });

export const metadata: Metadata = {
  title: "FeasibilityAI — Know if your business idea will work",
  description:
    "Turn a business idea into a professional 8-dimension feasibility report — market, financial, technical, competitive, location, operational, legal and risk — with a clear GO / NO-GO verdict.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable} ${notoArabic.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
