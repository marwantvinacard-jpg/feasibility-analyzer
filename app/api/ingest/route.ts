// POST /api/ingest — pull plain text out of an uploaded document so it can be
// attached to an analysis as extra context. Accepts PDF, Word (.docx), Excel
// (.xlsx/.xls), CSV and plain text. No auth, no storage — text is returned to
// the browser, which keeps it with the analysis input.

import { NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/firebase/verify";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB upload cap
const MAX_CHARS = 20_000; // keep prompt cost sane

export async function POST(req: Request) {
  try {
    await requireUser(req); // signed-in only — parsing documents isn't free
  } catch (err) {
    const e = err as HttpError;
    return NextResponse.json({ error: e.message ?? "Unauthorized" }, { status: e.status ?? 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File is larger than 15 MB." }, { status: 413 });

  const name = file.name || "document";
  const ext = name.toLowerCase().split(".").pop() || "";
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    let text = "";

    if (ext === "pdf" || file.type === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buf });
      text = (await parser.getText()).text ?? "";
    } else if (ext === "docx" || file.type.includes("wordprocessingml")) {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer: buf })).value ?? "";
    } else if (["xlsx", "xls", "ods"].includes(ext) || file.type.includes("spreadsheet")) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "buffer" });
      text = wb.SheetNames.map((s) => `# ${s}\n${XLSX.utils.sheet_to_csv(wb.Sheets[s])}`).join("\n\n");
    } else if (["txt", "md", "csv", "tsv", "json", "log", "rtf"].includes(ext) || file.type.startsWith("text/")) {
      text = buf.toString("utf8");
    } else {
      // last resort: treat as text; if it's binary this yields garbage, so guard.
      const asText = buf.toString("utf8");
      const printable = asText.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "").length / (asText.length || 1);
      if (printable < 0.7)
        return NextResponse.json({ error: `Unsupported file type: .${ext}` }, { status: 415 });
      text = asText;
    }

    text = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    const truncated = text.length > MAX_CHARS;
    if (truncated) text = text.slice(0, MAX_CHARS) + "\n…[truncated]";

    if (!text) return NextResponse.json({ error: "No readable text found in the file." }, { status: 422 });
    return NextResponse.json({ name, chars: text.length, truncated, text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? `Could not read ${name}: ${err.message}` : "Extraction failed" },
      { status: 500 }
    );
  }
}
