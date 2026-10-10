// Bring-your-own-key (BYOK): a customer's own AI provider key, stored so the
// server can run their analyses on it. Server-only.
//
// Storage: users/{uid}/secrets/llm — a subcollection the security rules make
// unreadable/unwritable from any browser (Admin SDK only). The key itself is
// never stored in plain text: it's encrypted with AES-256-GCM under
// BYOK_ENCRYPTION_KEY (an env secret, never in the database), with the user's
// uid bound in as authenticated data — a ciphertext copied onto another user's
// record won't decrypt. Only the provider and the last 4 characters are kept
// in readable form (on the user doc) so the UI can show "OpenAI key ••••abcd".

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import OpenAI from "openai";
import { HOSTED, type HostedProviderName } from "./engine/factory";
import { BYOK_PROVIDER_LABELS } from "./byokProviders";

export { BYOK_PROVIDER_LABELS };
export const BYOK_PROVIDERS = Object.keys(HOSTED) as HostedProviderName[];

export class ByokError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface EncryptedSecret {
  v: 1;
  iv: string; // base64, 12 bytes
  tag: string; // base64, 16 bytes
  ct: string; // base64 ciphertext
}

function encryptionKey(): Buffer {
  const raw = process.env.BYOK_ENCRYPTION_KEY;
  if (!raw) throw new ByokError(503, "Bring-your-own-key isn't set up on this server yet.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new ByokError(503, "BYOK_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  return key;
}

export function encryptSecret(plaintext: string, uid: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(uid, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ct: ct.toString("base64") };
}

/** Throws if the data was tampered with, belongs to another user, or the server key changed. */
export function decryptSecret(secret: EncryptedSecret, uid: string): string {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(secret.iv, "base64"));
  decipher.setAAD(Buffer.from(uid, "utf8"));
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(secret.ct, "base64")), decipher.final()]).toString("utf8");
}

export function isByokProvider(p: unknown): p is HostedProviderName {
  return typeof p === "string" && (BYOK_PROVIDERS as string[]).includes(p);
}

/** Cheap shape check before we spend a network call on it. */
export function validateKeyFormat(apiKey: unknown): string {
  if (typeof apiKey !== "string") throw new ByokError(400, "Paste your API key.");
  const key = apiKey.trim();
  if (key.length < 20 || key.length > 400 || /\s/.test(key)) {
    throw new ByokError(400, "That doesn't look like an API key. Paste the whole key, with no spaces.");
  }
  return key;
}

/**
 * Asks the provider whether the key works (lists its models — free, no tokens
 * used). A rejected key is reported as such; if the provider can't be reached
 * we say so rather than storing a key we couldn't check.
 */
export async function verifyProviderKey(provider: HostedProviderName, apiKey: string): Promise<void> {
  const client = new OpenAI({ apiKey, baseURL: HOSTED[provider].baseURL, timeout: 10_000, maxRetries: 0 });
  try {
    await client.models.list();
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 403) {
      throw new ByokError(400, `${BYOK_PROVIDER_LABELS[provider]} rejected that key. Check it and try again.`);
    }
    throw new ByokError(502, `Couldn't reach ${BYOK_PROVIDER_LABELS[provider]} to check the key. Try again in a minute.`);
  }
}

export const last4 = (key: string) => key.slice(-4);
