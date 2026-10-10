// POST /api/extract — pre-fill the 10 fields from a free-text description.
// Powers the "just describe your business" box on the New Analysis form. Runs
// the engine's extractor; MOCK by default so it works with no keys.

import { NextResponse } from "next/server";
import { extractFromText } from "@/lib/engine/extractor";
import { createLlm } from "@/lib/engine/factory";
import { requireApprovedUser, HttpError } from "@/lib/firebase/verify";
import { checkRateLimit } from "@/lib/rateLimit";
import type { BusinessInput } from "@/lib/engine/types";
import { MAX_DESCRIBE_CHARS, TEXT_LIMITS } from "@/lib/engine/inputLimits";
import { readJsonBody } from "@/lib/engine/validateInput";

export const runtime = "nodejs";

// The already-filled form fields sent along for context. Uploaded documents
// aren't part of it, so the sum of the plain field limits is plenty.
const MAX_PREVIOUS_CHARS = Object.entries(TEXT_LIMITS)
  .filter(([k]) => k !== "knowledge_base")
  .reduce((sum, [, n]) => sum + n, 1000);

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function makeProvider() {
  return createLlm({ mockDelayMs: 500 });
}

export async function POST(req: Request) {
  try {
    const caller = await requireApprovedUser(req); // approved accounts only — this spends our AI budget
    const rl = await checkRateLimit(`extract:${caller.uid}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.` },
        { status: 429 }
      );
    }
    const body = await readJsonBody(req);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
    const { text, previous } = body.body as {
      text: string;
      previous?: Partial<BusinessInput>;
    };
    if (typeof text !== "string" || text.trim().length < 8) {
      return NextResponse.json({ error: "Please describe your business in a sentence or two." }, { status: 400 });
    }
    // Both go into the prompt, so both are capped before the model is called.
    if (text.length > MAX_DESCRIBE_CHARS) {
      return NextResponse.json(
        { error: `Description is too long (max ${MAX_DESCRIBE_CHARS.toLocaleString("en-US")} characters).` },
        { status: 400 }
      );
    }
    if (previous != null && (typeof previous !== "object" || JSON.stringify(previous).length > MAX_PREVIOUS_CHARS)) {
      return NextResponse.json({ error: "Form data is too large." }, { status: 400 });
    }
    const result = await extractFromText(makeProvider(), text, previous ?? {});
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Extraction failed" }, { status: 500 });
  }
}
