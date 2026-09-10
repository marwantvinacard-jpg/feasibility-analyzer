// POST /api/extract — pre-fill the 10 fields from a free-text description.
// Powers the "just describe your business" box on the New Analysis form.
// No auth (the app has no login); MOCK by default so it works with no keys.

import { NextResponse } from "next/server";
import { extractFromText } from "@/lib/engine/extractor";
import { createLlm } from "@/lib/engine/factory";
import type { BusinessInput } from "@/lib/engine/types";

export const runtime = "nodejs";

function makeProvider() {
  return createLlm({ mockDelayMs: 500 });
}

export async function POST(req: Request) {
  try {
    const { text, previous } = (await req.json()) as {
      text: string;
      previous?: Partial<BusinessInput>;
    };
    if (!text || text.trim().length < 8) {
      return NextResponse.json({ error: "Please describe your business in a sentence or two." }, { status: 400 });
    }
    const result = await extractFromText(makeProvider(), text, previous ?? {});
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Extraction failed" }, { status: 500 });
  }
}
