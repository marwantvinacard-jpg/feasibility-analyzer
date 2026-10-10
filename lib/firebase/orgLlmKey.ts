// An organization's shared AI key. When the owner sets one, every member's
// analyses run on it instead of the platform credit balance (a member's own
// personal key, if they saved one, still wins — their explicit choice beats
// the org default). Server-only.
//
// Stored at organizations/{orgId}/secrets/llmKey (the security rules deny all
// browser access), encrypted exactly like a personal key (see lib/byok.ts) and
// bound to the org: a copy pasted onto another org's record won't decrypt. The
// org doc itself only carries `sharedAiKey: { provider, last4 }`, so members'
// screens can show that runs are covered without ever seeing the key.

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./admin";
import { decryptSecret, encryptSecret, last4, type EncryptedSecret } from "../byok";
import type { ByokProvider } from "../byokProviders";

export type StoredOrgKey = EncryptedSecret & { provider: ByokProvider; last4: string; updatedAt: number; updatedBy: string };

const orgRef = (orgId: string) => adminDb().collection("organizations").doc(orgId);
export const orgKeyRef = (orgId: string) => orgRef(orgId).collection("secrets").doc("llmKey");
const binding = (orgId: string) => `org:${orgId}`;

export async function saveOrgLlmKey(orgId: string, provider: ByokProvider, apiKey: string, updatedBy: string): Promise<void> {
  const stored: StoredOrgKey = { ...encryptSecret(apiKey, binding(orgId)), provider, last4: last4(apiKey), updatedAt: Date.now(), updatedBy };
  const batch = adminDb().batch();
  batch.set(orgKeyRef(orgId), stored);
  batch.update(orgRef(orgId), { sharedAiKey: { provider, last4: stored.last4 } });
  await batch.commit();
}

export async function clearOrgLlmKey(orgId: string): Promise<void> {
  const batch = adminDb().batch();
  batch.delete(orgKeyRef(orgId));
  batch.update(orgRef(orgId), { sharedAiKey: FieldValue.delete() });
  await batch.commit();
}

/** What the owner sees: the provider and the last 4 characters, never the key. */
export async function getOrgLlmKeyInfo(orgId: string): Promise<{ provider: ByokProvider; last4: string } | null> {
  const d = (await orgKeyRef(orgId).get()).data() as StoredOrgKey | undefined;
  return d ? { provider: d.provider, last4: d.last4 } : null;
}

/**
 * The decrypted key, for one run. Throws if it can't be read: tampered with,
 * the server's BYOK_ENCRYPTION_KEY changed, or saved by an older version of
 * the app in a different format — the owner then has to save it again.
 */
export function decryptOrgLlmKey(orgId: string, stored: StoredOrgKey): string {
  if (stored.v !== 1 || !stored.provider) throw new Error("The organization's shared AI key needs to be saved again.");
  return decryptSecret(stored, binding(orgId));
}

/** Loads and decrypts the org's key; null when none is set. */
export async function readOrgLlmKey(orgId: string): Promise<{ provider: ByokProvider; apiKey: string } | null> {
  const d = (await orgKeyRef(orgId).get()).data() as StoredOrgKey | undefined;
  return d ? { provider: d.provider, apiKey: decryptOrgLlmKey(orgId, d) } : null;
}
