"use client";

// Client-side reads of the analyses collection (writes are server-only per the
// security rules). Live via onSnapshot so the dashboard + report update in real
// time — including a run in progress watched from another device.

import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { getFirebase } from "./client";
import type { AnalysisDoc } from "@/lib/analysisTypes";

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

/** Delete an analysis via the server (clients can't delete directly). */
export async function deleteAnalysis(id: string): Promise<void> {
  const fb = getFirebase();
  const token = await fb!.auth.currentUser!.getIdToken();
  await fetch("/api/analysis/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id }),
  });
}

/** Convenience: get the current user's ID token for authorized API calls. */
export async function getIdToken(): Promise<string> {
  const fb = getFirebase();
  if (!fb?.auth.currentUser) throw new Error("Not signed in.");
  return fb.auth.currentUser.getIdToken();
}
