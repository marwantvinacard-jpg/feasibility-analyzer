// POST /api/analyze — the server-authoritative run (no auth: the app has no login):
//   1. create the analyses/{id} doc (scoped to the caller's browser clientId),
//   2. run the engine, streaming SSE progress AND persisting to Firestore,
//   3. on failure, mark it failed.
// The client polls /api/analysis/[id] for the record so reports persist; SSE is
// just for the live progress bar during the run.

import { runFeasibility } from "@/lib/engine/runFeasibility";
import { createLlm } from "@/lib/engine/factory";
import { SerpApiProvider } from "@/lib/engine/search";
import { adminDb } from "@/lib/firebase/admin";
import { SIX_STAGES, type BusinessInput, type StageName, type StageStatus } from "@/lib/engine/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const initialStages = () =>
  Object.fromEntries(SIX_STAGES.map((s) => [s, "pending"])) as Record<StageName, StageStatus>;

export async function POST(req: Request) {
  const { input, clientId } = (await req.json()) as { input: BusinessInput; clientId?: string };
  if (!input?.business_idea) return json({ error: "Missing business input." }, 400);

  const uid = (clientId && clientId.trim()) || "guest";
  const db = adminDb();

  // --- create the analysis record ---
  const ref = db.collection("analyses").doc();
  const id = ref.id;
  await ref.set({
    id,
    uid,
    createdAt: Date.now(),
    status: "running",
    input,
    stageStatus: initialStages(),
  });

  const llm = createLlm();
  const search = new SerpApiProvider({ mock: llm.mock || !process.env.SERPAPI_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      send("start", { analysisId: id, stages: SIX_STAGES });
      const stageStatus = initialStages();

      try {
        const result = await runFeasibility(input, {
          llm,
          search,
          onProgress: (stage, status) => {
            stageStatus[stage] = status;
            send("progress", { stage, status });
            ref.update({ [`stageStatus.${stage}`]: status }).catch(() => {});
          },
        });
        await ref.update({ status: "complete", result, stageStatus });
        send("done", { analysisId: id });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Analysis failed";
        await ref.update({ status: "failed", error: message }).catch(() => {});
        send("error", { message });
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

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
