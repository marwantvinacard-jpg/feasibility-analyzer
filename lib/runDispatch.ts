// Starts an analysis run in the background. Server-only.
//
// On Firebase App Hosting (Cloud Run) a server's CPU is throttled as soon as it
// has replied to the browser, so work "after the response" can crawl or stall.
// There the run is handed to Cloud Tasks, which calls our internal endpoint
// (/api/internal/run-analysis) and the run happens inside THAT request, with
// full CPU. Configure with:
//   ANALYSIS_TASKS_QUEUE  projects/<project>/locations/<region>/queues/<queue>
//   APP_URL               the app's public https URL (Cloud Tasks calls it)
//   INTERNAL_TASK_SECRET  a long random string, shared with the endpoint
// Without a queue (local development, Vercel) it falls back to Next.js
// `after()`, which is reliable there.

import { GoogleAuth } from "google-auth-library";
import { runAfterResponse } from "./afterResponse";
import { executeAnalysis } from "./analysisRunner";

export interface EnqueueDeps {
  endpoint?: string;
  getToken?: () => Promise<string>;
  fetchImpl?: typeof fetch;
}

const defaultToken = async () => {
  const token = await new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] }).getAccessToken();
  if (!token) throw new Error("No Google access token for Cloud Tasks.");
  return token;
};

/** Creates the Cloud Tasks job that will run this analysis. */
export async function enqueueRunTask(analysisId: string, deps: EnqueueDeps = {}): Promise<void> {
  const queue = process.env.ANALYSIS_TASKS_QUEUE!;
  const base = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const secret = process.env.INTERNAL_TASK_SECRET;
  if (!base || !secret) throw new Error("ANALYSIS_TASKS_QUEUE is set but APP_URL or INTERNAL_TASK_SECRET is missing.");

  const endpoint = deps.endpoint ?? "https://cloudtasks.googleapis.com";
  const token = await (deps.getToken ?? defaultToken)();
  const res = await (deps.fetchImpl ?? fetch)(`${endpoint}/v2/${queue}/tasks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      task: {
        dispatchDeadline: "600s",
        httpRequest: {
          url: `${base}/api/internal/run-analysis`,
          httpMethod: "POST",
          headers: { "Content-Type": "application/json", "X-Internal-Secret": secret },
          body: Buffer.from(JSON.stringify({ analysisId })).toString("base64"),
        },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Cloud Tasks ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** Queue it (Firebase) or run it after the response (local / Vercel). */
export async function dispatchAnalysisRun(analysisId: string): Promise<void> {
  if (process.env.ANALYSIS_TASKS_QUEUE) {
    await enqueueRunTask(analysisId);
    return;
  }
  runAfterResponse(() => executeAnalysis(analysisId));
}
