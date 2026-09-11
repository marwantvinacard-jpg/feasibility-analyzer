"use client";

// Client-side org data access. Reads go straight to Firestore (live via
// onSnapshot, gated by firestore.rules); writes go through the /api/org*
// routes since org creation, membership and API keys are server-authoritative.

import { collection, doc, onSnapshot } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/client";
import { getIdToken } from "@/lib/analyses";
import type { Organization, OrgMember, ApiKeyDoc, OrgRole } from "@/lib/orgTypes";

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await getIdToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export async function fetchMyOrg(): Promise<{ org: Organization | null; members: OrgMember[] }> {
  return authedFetch("/api/org");
}

export async function createOrg(name: string): Promise<{ org: Organization }> {
  return authedFetch("/api/org", { method: "POST", body: JSON.stringify({ name }) });
}

export async function updateOrgBranding(patch: { name?: string; logoUrl?: string; primaryColor?: string }): Promise<void> {
  await authedFetch("/api/org", { method: "PATCH", body: JSON.stringify(patch) });
}

export async function inviteMember(identifier: string, role?: OrgRole): Promise<{ member: OrgMember }> {
  return authedFetch("/api/org/members", { method: "POST", body: JSON.stringify({ identifier, role }) });
}

export async function removeMember(uid: string): Promise<void> {
  await authedFetch(`/api/org/members?uid=${encodeURIComponent(uid)}`, { method: "DELETE" });
}

export async function createApiKey(label: string): Promise<{ key: string; meta: ApiKeyDoc }> {
  return authedFetch("/api/org/keys", { method: "POST", body: JSON.stringify({ label }) });
}

export async function revokeApiKey(id: string): Promise<void> {
  await authedFetch(`/api/org/keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Live subscription to an org's API keys (metadata only — never the raw secret). */
export function subscribeApiKeys(orgId: string, cb: (keys: ApiKeyDoc[]) => void): () => void {
  const fb = getFirebase();
  if (!fb) return () => {};
  return onSnapshot(
    collection(fb.db, "organizations", orgId, "apiKeys"),
    (snap) => cb(snap.docs.map((d) => d.data() as ApiKeyDoc).sort((a, b) => b.createdAt - a.createdAt)),
    () => cb([])
  );
}

/** Live subscription to an org's own doc (branding etc). */
export function subscribeOrgDoc(orgId: string, cb: (org: Organization | null) => void): () => void {
  const fb = getFirebase();
  if (!fb) return () => {};
  return onSnapshot(
    doc(fb.db, "organizations", orgId),
    (snap) => cb(snap.exists() ? (snap.data() as Organization) : null),
    () => cb(null)
  );
}
