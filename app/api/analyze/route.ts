// POST /api/analyze — runs the full feasibility engine and STREAMS per-stage
// progress back as Server-Sent Events, then a final `done` event with the whole
// result. This is the concept stand-in for the Cloud Tasks + Cloud Run worker +
// Firestore onSnapshot progress we'll build at the Firebase step; the client
// UX (live "Market ✓ · Financial ⏳ …") is identical.

import { runFeasibility } from "@/lib/engine/runFeasibility";
import { OpenAIProvider } from "@/lib/engine/provider";
import { SerpApiProvider } from "@/lib/engine/search";
import type { BusinessInput } from "@/lib/engine/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { input } = (await req.json()) as { input: BusinessInput };

  // Concept build: MOCK unless real keys are configured AND mock is disabled.
  const mock = process.env.FEASIBILITY_MOCK !== "false" || !process.env.OPENAI_API_KEY;
  const llm = new OpenAIProvider({ mock, mockDelayMs: 700 });
  const search = new SerpApiProvider({ mock: mock || !process.env.SERPAPI_API_KEY });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      send("start", { stages: ["market", "financial", "technical", "competitive", "location", "risk"] });
      try {
        const result = await runFeasibility(input, {
          llm,
          search,
          onProgress: (stage, status) => send("progress", { stage, status }),
        });
        send("done", result);
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "Analysis failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
