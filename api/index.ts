import type { Request, Response } from "express";
import { createApp } from "../server";

// Vercel calls this handler per-request. `createApp()` does no async work
// worth re-running on every invocation (no top-level await except the
// dev-only Vite import, which never runs here since NODE_ENV=production),
// so it's built once per cold start and reused across warm invocations.
let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(req: Request, res: Response) {
  if (!appPromise) {
    appPromise = createApp();
  }
  const app = await appPromise;
  return (app as any)(req, res);
}
