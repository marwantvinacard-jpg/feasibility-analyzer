"use client";

// Client reads of the analyses collection (writes are server-only per the
// security rules). A single report is live via onSnapshot, including a run in
// progress watched from another device. Lists (dashboard, Benchmarks) come
// from GET /api/analyses as slim summaries, refreshed while a run is going.

import { useCallback, useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import type { AnalysisDoc, AnalysisSummary, ScenarioDoc } from "@/lib/analysisTypes";

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

/** Throws with the server's message when the delete didn't happen (it used to report success regardless). */
export async function deleteAnalysis(id: string): Promise<void> {
  await authedFetchJson("/api/analysis/delete", { method: "POST", body: JSON.stringify({ id }) });
}

export async function reviewAnalysis(id: string, notes: string): Promise<void> {
  await authedFetch("/api/analysis/review", { method: "POST", body: JSON.stringify({ id, notes }) });
}

export async function saveScenario(analysisId: string, name: string, knobs: Record<string, number>): Promise<void> {
  await authedFetch("/api/scenarios", { method: "POST", body: JSON.stringify({ analysisId, name, knobs }) });
}

async function authedFetchJson(url: string, init: RequestInit = {}) {
  const res = await authedFetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

/**
 * Starts an analysis. The server replies at once with its id and runs it in
 * the background; the report page follows its progress live. Throws with the
 * server's message (validation, credits, key problems) if it didn't start.
 */
export async function startAnalysis(input: unknown): Promise<string> {
  const data = (await authedFetchJson("/api/analyze", { method: "POST", body: JSON.stringify({ input }) })) as {
    analysisId: string;
  };
  return data.analysisId;
}

/** Asks the server to settle a run that has been "running" longer than any run can live. */
export async function checkAnalysis(id: string): Promise<void> {
  await authedFetchJson("/api/analysis/check", { method: "POST", body: JSON.stringify({ id }) });
}

/** Downloads the study PDF, rendered and entitlement-checked on the server. */
export async function downloadAnalysisPdf(id: string): Promise<void> {
  const res = await authedFetch(`/api/analysis/${encodeURIComponent(id)}/pdf`);
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Download failed");
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "feasibility-report.pdf";
  const url = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Downloads everything held about the signed-in user as a JSON file. */
export async function downloadMyData(): Promise<void> {
  const res = await authedFetch("/api/account/export");
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Download failed");
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: `feasibilityai-data-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

/** Permanently deletes the signed-in user's account (the server requires the word DELETE). */
export async function deleteMyAccount(confirm: string): Promise<void> {
  await authedFetchJson("/api/account", { method: "DELETE", body: JSON.stringify({ confirm }) });
}

/** Store the user's own AI key (checked with the provider and encrypted server-side). */
export async function saveByokKey(provider: string, apiKey: string): Promise<{ provider: string; last4: string }> {
  return authedFetchJson("/api/account/byok", { method: "POST", body: JSON.stringify({ provider, apiKey }) });
}

export async function removeByokKey(): Promise<void> {
  await authedFetchJson("/api/account/byok", { method: "DELETE" });
}

/** Save a hand-edited financial model — recomputed deterministically server-side, free. */
export async function saveFinancialModel(id: string, model: unknown): Promise<{ projections: unknown }> {
  return authedFetchJson("/api/analysis/model", { method: "PATCH", body: JSON.stringify({ id, model }) });
}

/** Re-writes the study's narrative against the current model. Costs 1 credit. */
export async function regenerateNarrative(id: string): Promise<{ narrative: unknown }> {
  return authedFetchJson("/api/analysis/regenerate-narrative", { method: "POST", body: JSON.stringify({ id }) });
}

export async function deleteScenario(analysisId: string, scenarioId: string): Promise<void> {
  await authedFetchJson(
    `/api/scenarios?analysisId=${encodeURIComponent(analysisId)}&scenarioId=${encodeURIComponent(scenarioId)}`,
    { method: "DELETE" }
  );
}

/** How often the list refreshes while one of its analyses is still running. */
const RUNNING_POLL_MS = 5000;

/**
 * Slim analysis summaries for the dashboard ("mine") or Benchmarks ("org").
 * Replaces live subscriptions to every full analysis doc. Refreshes on window
 * focus, and every few seconds while any listed analysis is still running.
 */
export function useAnalysisSummaries(scope: "mine" | "org", enabled = true) {
  const [items, setItems] = useState<AnalysisSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  const reload = useCallback(async () => {
    try {
      const data = (await authedFetchJson(`/api/analyses?scope=${scope}`)) as { items: AnalysisSummary[]; truncated: boolean };
      setItems(data.items);
      setTruncated(data.truncated);
    } catch {
      /* keep what we have; the next focus/poll retries */
    } finally {
      setLoaded(true);
    }
  }, [scope]);

  useEffect(() => {
    if (!enabled) return;
    reload();
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [enabled, reload]);

  const anyRunning = items.some((i) => i.status === "running");
  useEffect(() => {
    if (!enabled || !anyRunning) return;
    const id = setInterval(reload, RUNNING_POLL_MS);
    return () => clearInterval(id);
  }, [enabled, anyRunning, reload]);

  return { items, loaded, truncated, reload };
}
