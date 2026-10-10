// Run work after the response is sent WITHOUT it being dropped, via Next.js
// `after()`. Reliable on Vercel (the function is kept alive for it) and in
// local development. NOT used for anything important on Firebase App Hosting /
// Cloud Run, where CPU is throttled after the reply: analyses go through Cloud
// Tasks there (lib/runDispatch.ts) and emails are awaited before replying.
//
// Outside a Next.js request (scripts, tests) `after()` throws, so the work
// just runs in the background there instead.

import { after } from "next/server";

export function runAfterResponse(work: () => Promise<unknown>): void {
  const task = () => work().catch(() => {}); // callers log their own failures
  try {
    after(task);
  } catch {
    void task();
  }
}
