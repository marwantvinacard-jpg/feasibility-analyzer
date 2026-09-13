import type { Request, Response } from "express";
// `./_server.mjs` is generated at build time by `npm run build:vercel`
// (esbuild-bundles server.ts, since Vercel's own build only runs `vite
// build` — see vercel.json). It must be co-located with this file and
// carry an explicit extension so Node's ESM loader can resolve it at
// runtime; a bare `../server` import isn't traced/bundled by Vercel and
// fails with ERR_MODULE_NOT_FOUND in production.
// @ts-ignore -- generated file, not present until build time
import { createApp } from "./_server.mjs";

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
