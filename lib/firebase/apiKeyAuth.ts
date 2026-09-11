// Server-side auth for the public v1 API — authenticates by API key instead
// of a Firebase ID token. Keys are looked up by SHA-256 hash via a Firestore
// collection-group query across every org's apiKeys subcollection.

import { createHash } from "node:crypto";
import { adminDb } from "./admin";
import { HttpError } from "./verify";

export interface ApiCaller {
  orgId: string;
  ownerUid: string;
  keyId: string;
}

export async function requireApiKey(req: Request): Promise<ApiCaller> {
  const authz = req.headers.get("authorization") ?? "";
  const key = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!key) throw new HttpError(401, "Missing API key. Pass it as 'Authorization: Bearer <key>'.");

  const hash = createHash("sha256").update(key).digest("hex");
  const db = adminDb();
  const snap = await db.collectionGroup("apiKeys").where("keyHash", "==", hash).limit(1).get();
  if (snap.empty) throw new HttpError(401, "Invalid API key.");

  const keyDoc = snap.docs[0];
  const data = keyDoc.data();
  if (data.revoked) throw new HttpError(401, "This API key has been revoked.");

  const orgRef = keyDoc.ref.parent.parent;
  if (!orgRef) throw new HttpError(500, "Malformed API key record.");
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) throw new HttpError(401, "The organization for this key no longer exists.");

  keyDoc.ref.update({ lastUsedAt: Date.now() }).catch(() => {});

  return { orgId: orgRef.id, ownerUid: orgSnap.data()?.ownerUid as string, keyId: keyDoc.id };
}
