"use client";

// "Export PDF" — prints the pre-built, off-screen .print-root copy of the
// report through the browser's own print engine (window.print → "Save as
// PDF"), instead of rasterizing the DOM with html2canvas. That's a real
// document render: actual selectable text, the browser's own font shaping,
// and real page breaks via @page/break-inside — not a screenshot glued into
// a PDF wrapper. See the `body.printing-report` rules in app/globals.css.

export function slugify(s: string, max = 40): string {
  return (s || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, max) || "report";
}

/**
 * Marks `node` as the print target, sets the document title to `filename`
 * (Chrome/Edge/Safari all suggest the page title as the default "Save as
 * PDF" filename), opens the print dialog, and restores everything once
 * printing is dismissed — whether the user saves or cancels.
 */
export function printReport(node: HTMLElement, filename: string): void {
  const previousTitle = document.title;
  node.classList.add("print-root");
  document.body.classList.add("printing-report");
  document.title = filename.replace(/\.pdf$/i, "");

  const restore = () => {
    document.body.classList.remove("printing-report");
    node.classList.remove("print-root");
    document.title = previousTitle;
    window.removeEventListener("afterprint", restore);
  };
  // `afterprint` fires once the dialog is dismissed either way (saved or
  // cancelled) in every browser this app supports — a blind setTimeout
  // fallback would risk reverting the DOM while Chrome's live print preview
  // is still open, corrupting the very print job it's meant to protect.
  window.addEventListener("afterprint", restore);
  window.print();
}
