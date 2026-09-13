import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for user API keys at rest.
 * The master secret comes from KEY_ENCRYPTION_SECRET (Cloud Run env / Secret Manager).
 * We derive a stable 32-byte key from it via SHA-256 so any length secret works.
 */

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "KEY_ENCRYPTION_SECRET is missing or too short (need >= 16 chars)."
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export interface EncryptedRecord {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

export function encryptKey(plaintext: string): EncryptedRecord {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptKey(record: EncryptedRecord): string {
  const key = getKey();
  const decipher = crypto.createDecipheriv(
    ALGO,
    key,
    Buffer.from(record.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}
