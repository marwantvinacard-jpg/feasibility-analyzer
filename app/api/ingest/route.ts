// POST /api/ingest — pull plain text out of an uploaded document so it can be
// attached to an analysis as extra context. Accepts PDF, Word (.docx), Excel
// (.xlsx), CSV and plain text. No auth, no storage — text is returned to
// the browser, which keeps it with the analysis input.
//
// Excel parsing uses exceljs, not the `xlsx` (SheetJS) package: SheetJS has an
// unpatched high-severity prototype-pollution + ReDoS advisory, and this route
// feeds it arbitrary user-uploaded files — the exact untrusted-input path
// those advisories are about. exceljs only reads the modern .xlsx (OOXML)
// format, so legacy .xls/.ods uploads are no longer supported — signed-in
// users are the only reachable audience for that regression.

import { NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/firebase/verify";
import { checkRateLimit } from "@/lib/rateLimit";
import { logError } from "@/lib/firebase/errorLog";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB upload cap
const MAX_CHARS = 20_000; // keep prompt cost sane
const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60_000;

// exceljs cell values can be a primitive, a Date, a formula result object
// ({ result, formula }), or rich text ({ richText: [{ text }, ...] }).
function cellToText(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.result !== undefined) return cellToText(o.result);
    if (o.text !== undefined) return String(o.text);
    return "";
  }
  return String(v);
}

export async function POST(req: Request) {
  let caller;
  try {
    caller = await requireUser(req); // signed-in only — parsing documents isn't free
  } catch (err) {
    const e = err as HttpError;
    return NextResponse.json({ error: e.message ?? "Unauthorized" }, { status: e.status ?? 401 });
  }

  const rl = checkRateLimit(caller.uid, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many uploads. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.` },
      { status: 429 }
    );
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
    } else if (ext === "xlsx" || file.type.includes("spreadsheet")) {
      const { default: ExcelJS } = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      // exceljs's Buffer type comes from its own @types/node, which can drift
      // from this project's — both are Node Buffers at runtime.
      await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
      const sheets: string[] = [];
      wb.eachSheet((sheet) => {
        const rows: string[] = [];
        sheet.eachRow((row) => {
          const cells = (row.values as unknown[]).slice(1).map(cellToText);
          rows.push(cells.join(","));
        });
        sheets.push(`# ${sheet.name}\n${rows.join("\n")}`);
      });
      text = sheets.join("\n\n");
    } else if (["xls", "ods"].includes(ext)) {
      return NextResponse.json(
        { error: `.${ext} isn't supported — save it as .xlsx and try again.` },
        { status: 415 }
      );
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
    // The parser's own error text (a pdf-parse/mammoth internal message) isn't
    // meant for an end user and could carry more detail than intended — log it
    // server-side and give the caller a generic reason instead.
    await logError("ingest.extract", err, { fileName: name });
    return NextResponse.json({ error: `Could not read ${name}. Try a different file or format.` }, { status: 500 });
  }
}
