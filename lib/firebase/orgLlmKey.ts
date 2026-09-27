// Encrypt-at-rest for an organization's shared AI API key. When an org owner
// sets one, every approved member's analyses run on it instead of the
// platform credit balance or a personal BYOK key (which still takes
// priority — a member's own explicit choice wins over the org default).
// Stored in the server-only organizations/{orgId}/secrets/llmKey doc
// (Firestore rules deny all client access). Same AES-256-GCM scheme and key
// as lib/firebase/byokKey.ts.

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { adminDb } from "./admin";

function encryptionKey(): Buffer {
  const b64 = process.env.BYOK_ENCRYPTION_KEY;
  if (!b64) throw new Error("BYOK_ENCRYPTION_KEY is not set — API keys cannot be stored without it.");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("BYOK_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}

function secretRef(orgId: string) {
  return adminDb().collection("organizations").doc(orgId).collection("secrets").doc("llmKey");
}

export async function saveOrgLlmKey(orgId: string, rawKey: string): Promise<void> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(rawKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  await secretRef(orgId).set({
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: authTag.toString("base64"),
    keyPreview: `${rawKey.slice(0, 6)}…${rawKey.slice(-4)}`,
    savedAt: Date.now(),
  });
}

export async function clearOrgLlmKey(orgId: string): Promise<void> {
  await secretRef(orgId).delete();
}

/** Returns the preview string (e.g. "sk-abc1…9f2a") without ever decrypting, for display only. */
export async function getOrgLlmKeyPreview(orgId: string): Promise<string | null> {
  const snap = await secretRef(orgId).get();
  return (snap.data()?.keyPreview as string | undefined) ?? null;
}

/** Server-only: decrypts and returns the raw key for making an actual API call. */
export async function getOrgLlmKey(orgId: string): Promise<string | null> {
  const snap = await secretRef(orgId).get();
  const data = snap.data();
  if (!data) return null;
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(data.iv, "base64"));
  decipher.setAuthTag(Buffer.from(data.authTag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(data.ciphertext, "base64")), decipher.final()]);
  return plain.toString("utf8");
}
