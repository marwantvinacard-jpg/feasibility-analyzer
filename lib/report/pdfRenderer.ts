// Server-side PDF rendering with headless Chromium. Server-only.
//
// The export used to be built in the browser by html2pdf.js, which draws the
// whole report into ONE canvas image: a long study (~30 pages, 60k+ px tall)
// exceeds the browser's canvas limits and comes out blank or cut off, and the
// "paid" file could be produced by anyone from the page. Now the server prints
// the report's HTML with Chromium's own PDF engine — real pagination, real
// (selectable) text, Arabic shaping — and only for someone entitled to it.
//
// Browser: CHROME_EXECUTABLE_PATH if set (local development: point it at an
// installed Chrome/Edge); otherwise @sparticuz/chromium, a Chromium build for
// Linux servers (Firebase App Hosting / Cloud Run).

import type { Browser } from "puppeteer-core";

let browserPromise: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default;
  const localChrome = process.env.CHROME_EXECUTABLE_PATH;
  if (localChrome) {
    return puppeteer.launch({ executablePath: localChrome, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  }
  const chromium = (await import("@sparticuz/chromium")).default;
  return puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    headless: true,
  });
}

/** One browser per server instance, reused across requests; relaunched if it died. */
async function browser(): Promise<Browser> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b?.connected) return b;
  }
  browserPromise = launch();
  return browserPromise;
}

export async function renderPdf(html: string): Promise<Uint8Array> {
  const page = await (await browser()).newPage();
  try {
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "12mm", bottom: "14mm", left: "10mm", right: "10mm" },
      timeout: 60_000,
    });
  } finally {
    await page.close().catch(() => {});
  }
}
