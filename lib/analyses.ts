"use client";

// Client reads of saved analyses. No backend — these read the local IndexedDB
// store. "subscribe" keeps its old meaning: call the callback now and again
// whenever the store changes (and on a slow poll, so a run finishing in this
// same tab is picked up).

import { getAnalysis, listAnalyses, onAnalysesChanged, removeAnalysis } from "@/lib/store";
import type { AnalysisDoc } from "@/lib/analysisTypes";

export function subscribeAnalyses(_uid: string, cb: (items: AnalysisDoc[]) => void): () => void {
  let alive = true;
  const pull = () => listAnalyses().then((i) => alive && cb(i));
  pull();
  const off = onAnalysesChanged(pull);
  const h = setInterval(pull, 2000);
  return () => { alive = false; off(); clearInterval(h); };
}

export function subscribeAnalysis(id: string, cb: (item: AnalysisDoc | null) => void): () => void {
  let alive = true;
  const pull = () => getAnalysis(id).then((i) => alive && cb(i));
  pull();
  const off = onAnalysesChanged(pull);
  const h = setInterval(pull, 2000);
  return () => { alive = false; off(); clearInterval(h); };
}

export async function deleteAnalysis(id: string): Promise<void> {
  await removeAnalysis(id);
}
