"use client";

// Client reads of the analyses collection (writes are server-only per the
// security rules). Live via onSnapshot so the dashboard + report update in
// real time — including a run in progress watched from another device.

import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import type { AnalysisDoc, ScenarioDoc } from "@/lib/analysisTypes";

/** Subscribe to all of a user's analyses (sorted newest-first client-side to avoid a composite index). */
export function subscribeAnalyses(uid: string, cb: (items: AnalysisDoc[]) => void): () => void {
  const fb = getFirebase();
  if (!fb) return () => {};
  const q = query(collection(fb.db, "analyses"), where("uid", "==", uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as AnalysisDoc).sort((a, b) => b.createdAt - a.createdAt);
      cb(items);
    },
    () => cb([])
  );
}

/** Subscribe to every analysis visible to an org (own + teammates') for benchmarking. */
export function subscribeOrgAnalyses(orgId: string, cb: (items: AnalysisDoc[]) => void): () => void {
  const fb = getFirebase();
  if (!fb) return () => {};
  const q = query(collection(fb.db, "analyses"), where("orgId", "==", orgId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as AnalysisDoc).sort((a, b) => b.createdAt - a.createdAt);
      cb(items);
    },
    () => cb([])
  );
}

/** Subscribe to a single analysis (live progress while running, then the result). */
export function subscribeAnalysis(id: string, cb: (item: AnalysisDoc | null) => void): () => void {
  const fb = getFirebase();
  if (!fb) return () => {};
  return onSnapshot(
    doc(fb.db, "analyses", id),
    (snap) => cb(snap.exists() ? (snap.data() as AnalysisDoc) : null),
    () => cb(null)
  );
}

/** Subscribe to an analysis's saved stress-test scenarios. */
export function subscribeScenarios(analysisId: string, cb: (items: ScenarioDoc[]) => void): () => void {
  const fb = getFirebase();
  if (!fb) return () => {};
  return onSnapshot(
    collection(fb.db, "analyses", analysisId, "scenarios"),
    (snap) => cb(snap.docs.map((d) => d.data() as ScenarioDoc).sort((a, b) => b.createdAt - a.createdAt)),
    () => cb([])
  );
}

/** Convenience: get the current user's ID token for authorized API calls. */
export async function getIdToken(): Promise<string> {
  const fb = getFirebase();
  if (!fb?.auth.currentUser) throw new Error("Not signed in.");
  return fb.auth.currentUser.getIdToken();
}

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await getIdToken();
  return fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
}

export async function deleteAnalysis(id: string): Promise<void> {
  await authedFetch("/api/analysis/delete", { method: "POST", body: JSON.stringify({ id }) });
}

export async function reviewAnalysis(id: string, notes: string): Promise<void> {
  await authedFetch("/api/analysis/review", { method: "POST", body: JSON.stringify({ id, notes }) });
}

export async function saveScenario(analysisId: string, name: string, knobs: Record<string, number>): Promise<void> {
  await authedFetch("/api/scenarios", { method: "POST", body: JSON.stringify({ analysisId, name, knobs }) });
}

export async function deleteScenario(analysisId: string, scenarioId: string): Promise<void> {
  await authedFetch(`/api/scenarios?analysisId=${analysisId}&scenarioId=${scenarioId}`, { method: "DELETE" });
}
