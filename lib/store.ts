"use client";

// Local analysis store (IndexedDB). The app has no backend database: a run's
// full result arrives over SSE and is saved here, in the visitor's browser.
// One object store, keyed by analysis id.

import type { AnalysisDoc } from "@/lib/analysisTypes";

const DB = "feasibility";
const STORE = "analyses";
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no IndexedDB"));
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

/** Fired on the window whenever the store changes, so open views can refresh. */
const CHANGED = "fa:analyses-changed";
function announce() {
  try { window.dispatchEvent(new Event(CHANGED)); } catch { /* noop */ }
}
export function onAnalysesChanged(cb: () => void): () => void {
  window.addEventListener(CHANGED, cb);
  return () => window.removeEventListener(CHANGED, cb);
}

export async function saveAnalysis(rec: AnalysisDoc): Promise<void> {
  try {
    await tx("readwrite", (s) => s.put(rec));
    announce();
  } catch { /* private mode / no IDB — run is still shown for this session by the caller */ }
}

export async function getAnalysis(id: string): Promise<AnalysisDoc | null> {
  try {
    const r = await tx<AnalysisDoc | undefined>("readonly", (s) => s.get(id));
    return r ?? null;
  } catch { return null; }
}

export async function listAnalyses(): Promise<AnalysisDoc[]> {
  try {
    const r = await tx<AnalysisDoc[]>("readonly", (s) => s.getAll() as IDBRequest<AnalysisDoc[]>);
    return (r ?? []).sort((a, b) => b.createdAt - a.createdAt);
  } catch { return []; }
}

export async function removeAnalysis(id: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(id));
    announce();
  } catch { /* noop */ }
}
