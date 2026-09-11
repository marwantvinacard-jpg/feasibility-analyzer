"use client";

// Client-side "download this DOM as a PDF" — no print dialog. Lazy-loads
// html2pdf.js so it never touches the initial bundle.

export function slugify(s: string, max = 40): string {
  return (s || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, max) || "report";
}

export async function downloadElementPdf(node: HTMLElement, filename: string): Promise<void> {
  const { default: html2pdf } = await import("html2pdf.js");
  const opts: Record<string, unknown> = {
    margin: [10, 10, 12, 10],
    filename,
    image: { type: "jpeg", quality: 0.96 },
    html2canvas: { scale: 2, backgroundColor: "#ffffff", useCORS: true, windowWidth: 820 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "legacy"] },
  };
  // html2pdf.js types omit `pagebreak`; valid at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (html2pdf() as any).set(opts).from(node).save();
}
