"use client";

// Client reads of analyses. Firestore is server-only now (no client auth), so
// these poll lightweight API routes instead of using onSnapshot. The function
// names/shapes are unchanged so callers didn't need touching — "subscribe"
// just means "poll until you unsubscribe".

import { getClientId } from "@/lib/session";
import type { AnalysisDoc } from "@/lib/analysisTypes";

const LIST_MS = 2500;
const ONE_MS = 1500;

/** Poll all of this browser's analyses (newest-first). Returns an unsubscribe fn. */
export function subscribeAnalyses(uid: string, cb: (items: AnalysisDoc[]) => void): () => void {
  let alive = true;
  const tick = async () => {
    try {
      const r = await fetch(`/api/analyses?clientId=${encodeURIComponent(uid)}`, { cache: "no-store" });
      if (!alive) return;
      const items = r.ok ? ((await r.json()).items as AnalysisDoc[]) : [];
      cb(items.sort((a, b) => b.createdAt - a.createdAt));
    } catch {
      if (alive) cb([]);
    }
  };
  tick();
  const h = setInterval(tick, LIST_MS);
  return () => { alive = false; clearInterval(h); };
}

/** Poll a single analysis (live progress while running, then the result). */
export function subscribeAnalysis(id: string, cb: (item: AnalysisDoc | null) => void): () => void {
  let alive = true;
  let h: ReturnType<typeof setInterval> | null = null;
  const tick = async () => {
    try {
      const r = await fetch(`/api/analysis/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!alive) return;
      const item = r.ok ? ((await r.json()).item as AnalysisDoc | null) : null;
      cb(item);
      // stop polling once the run is settled
      if (item && item.status !== "running" && h) { clearInterval(h); h = null; }
    } catch {
      if (alive) cb(null);
    }
  };
  tick();
  h = setInterval(tick, ONE_MS);
  return () => { alive = false; if (h) clearInterval(h); };
}

/** Delete an analysis via the server. */
export async function deleteAnalysis(id: string): Promise<void> {
  await fetch("/api/analysis/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, clientId: getClientId() }),
  });
}
