// POST /api/analyze — run the engine and stream progress over SSE. No auth, no
// database: the final result is delivered in the `done` event and the browser
// saves it locally (lib/store.ts).

import { runFeasibility } from "@/lib/engine/runFeasibility";
import { createLlm } from "@/lib/engine/factory";
import { SerpApiProvider } from "@/lib/engine/search";
import { SIX_STAGES, type BusinessInput } from "@/lib/engine/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const { input } = (await req.json()) as { input: BusinessInput };
  if (!input?.business_idea) {
    return new Response(JSON.stringify({ error: "Missing business input." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = crypto.randomUUID();
  const llm = createLlm();
  const search = new SerpApiProvider({ mock: llm.mock || !process.env.SERPAPI_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      send("start", { analysisId: id, stages: SIX_STAGES });

      try {
        const result = await runFeasibility(input, {
          llm,
          search,
          onProgress: (stage, status) => send("progress", { stage, status }),
        });
        send("done", { analysisId: id, result });
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
