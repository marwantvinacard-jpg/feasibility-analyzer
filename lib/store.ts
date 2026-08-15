"use client";

// Local analyses store (localStorage). Stands in for the Firestore `analyses`
// collection so the dashboard, run view and report all work in the concept
// build. Same shape we'll persist in Firestore later.

import type { BusinessInput } from "./engine/types";
import type { FullResult } from "./engine/runFeasibility";

export type AnalysisStatus = "queued" | "running" | "complete" | "failed";

export interface AnalysisRecord {
  id: string;
  uid: string;
  createdAt: number;
  status: AnalysisStatus;
  input: BusinessInput;
  result?: FullResult;
}

const KEY = "fai_analyses";

function readAll(): AnalysisRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeAll(records: AnalysisRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(records));
}

export function newId(): string {
  return "an_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export function listAnalyses(uid: string): AnalysisRecord[] {
  return readAll()
    .filter((a) => a.uid === uid)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getAnalysis(id: string): AnalysisRecord | undefined {
  return readAll().find((a) => a.id === id);
}

export function saveAnalysis(rec: AnalysisRecord) {
  const all = readAll();
  const idx = all.findIndex((a) => a.id === rec.id);
  if (idx >= 0) all[idx] = rec;
  else all.push(rec);
  writeAll(all);
}

export function deleteAnalysis(id: string) {
  writeAll(readAll().filter((a) => a.id !== id));
}
