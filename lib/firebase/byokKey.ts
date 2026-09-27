// Encrypt-at-rest for a user's own AI API key (BYOK). Stored in the
// server-only users/{uid}/secrets/byok doc (Firestore rules deny all client
// access to that subcollection — Admin SDK only). AES-256-GCM with a key from
// BYOK_ENCRYPTION_KEY (32 random bytes, base64) — never derived from anything
// client-controlled, never logged, never returned to the client after save.

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { adminDb } from "./admin";

function encryptionKey(): Buffer {
  const b64 = process.env.BYOK_ENCRYPTION_KEY;
  if (!b64) throw new Error("BYOK_ENCRYPTION_KEY is not set — BYOK cannot store keys without it.");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("BYOK_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return key;
}

function secretRef(uid: string) {
  return adminDb().collection("users").doc(uid).collection("secrets").doc("byok");
}

export async function saveByokKey(uid: string, rawKey: string): Promise<void> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(rawKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  await secretRef(uid).set({
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: authTag.toString("base64"),
    keyPreview: `${rawKey.slice(0, 6)}…${rawKey.slice(-4)}`,
    savedAt: Date.now(),
  });
}

export async function clearByokKey(uid: string): Promise<void> {
  await secretRef(uid).delete();
}

/** Returns the preview string (e.g. "sk-abc1…9f2a") without ever decrypting, for display only. */
export async function getByokKeyPreview(uid: string): Promise<string | null> {
  const snap = await secretRef(uid).get();
  return (snap.data()?.keyPreview as string | undefined) ?? null;
}

/** Server-only: decrypts and returns the raw key for making an actual API call. */
export async function getByokKey(uid: string): Promise<string | null> {
  const snap = await secretRef(uid).get();
  const data = snap.data();
  if (!data) return null;
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(data.iv, "base64"));
  decipher.setAuthTag(Buffer.from(data.authTag, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(data.ciphertext, "base64")), decipher.final()]);
  return plain.toString("utf8");
}
