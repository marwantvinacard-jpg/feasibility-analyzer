import { test } from "node:test";
import assert from "node:assert/strict";
import { deploymentEnv, isProductionDeployment } from "@/lib/runtimeEnv";
import { enqueueRunTask } from "@/lib/runDispatch";

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const before: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    before[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("Firebase: APP_ENV decides production (VERCEL_ENV still works as a fallback; NODE_ENV never does)", () => {
  withEnv({ APP_ENV: "production", VERCEL_ENV: undefined }, () => assert.equal(isProductionDeployment(), true));
  withEnv({ APP_ENV: "staging", VERCEL_ENV: "production" }, () => assert.equal(isProductionDeployment(), false));
  withEnv({ APP_ENV: undefined, VERCEL_ENV: "production" }, () => assert.equal(isProductionDeployment(), true));
  withEnv({ APP_ENV: undefined, VERCEL_ENV: undefined, NODE_ENV: "production" }, () => {
    assert.equal(isProductionDeployment(), false);
    assert.equal(deploymentEnv(), "development");
  });
});

test("Firebase: an analysis job is queued as a Cloud Tasks HTTP task to the internal endpoint, with the secret", async () => {
  let url = "";
  let init: RequestInit = {};
  await withEnv(
    {
      ANALYSIS_TASKS_QUEUE: "projects/p1/locations/europe-west4/queues/analysis-runs",
      APP_URL: "https://app.example.com/",
      INTERNAL_TASK_SECRET: "s3cret",
    },
    () =>
      enqueueRunTask("abc123", {
        endpoint: "https://tasks.test",
        getToken: async () => "tok",
        fetchImpl: (async (u: string, i: RequestInit) => {
          url = u;
          init = i;
          return new Response("{}", { status: 200 });
        }) as unknown as typeof fetch,
      })
  );
  assert.equal(url, "https://tasks.test/v2/projects/p1/locations/europe-west4/queues/analysis-runs/tasks");
  assert.equal((init.headers as Record<string, string>).Authorization, "Bearer tok");
  const task = JSON.parse(String(init.body)).task;
  assert.equal(task.httpRequest.url, "https://app.example.com/api/internal/run-analysis");
  assert.equal(task.httpRequest.headers["X-Internal-Secret"], "s3cret");
  assert.deepEqual(JSON.parse(Buffer.from(task.httpRequest.body, "base64").toString()), { analysisId: "abc123" });
  assert.equal(task.dispatchDeadline, "600s");
});

test("Firebase: queueing fails loudly (so the run is refunded) when misconfigured or refused", async () => {
  await withEnv({ ANALYSIS_TASKS_QUEUE: "projects/p/locations/l/queues/q", APP_URL: undefined, NEXT_PUBLIC_APP_URL: undefined, INTERNAL_TASK_SECRET: "x" }, () =>
    assert.rejects(enqueueRunTask("a", { getToken: async () => "t" }), /APP_URL/)
  );
  await withEnv({ ANALYSIS_TASKS_QUEUE: "projects/p/locations/l/queues/q", APP_URL: "https://a", INTERNAL_TASK_SECRET: "x" }, () =>
    assert.rejects(
      enqueueRunTask("a", {
        getToken: async () => "t",
        fetchImpl: (async () => new Response("PERMISSION_DENIED", { status: 403 })) as unknown as typeof fetch,
      }),
      /Cloud Tasks 403/
    )
  );
});
