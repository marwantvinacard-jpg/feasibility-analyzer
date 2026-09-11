// Firebase Admin SDK (server-only). Powers privileged operations the client is
// forbidden from doing by the security rules: creating analyses, granting
// credits, approving accounts, writing the audit log. Credentials load from
// FIREBASE_SERVICE_ACCOUNT_JSON (prod) or the gitignored serviceAccountKey.json
// (local dev). Server-only — never import from a client component.

import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadServiceAccount(): Record<string, unknown> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.trim().startsWith("{")) return JSON.parse(raw);
  try {
    return JSON.parse(readFileSync(resolve(process.cwd(), "serviceAccountKey.json"), "utf8"));
  } catch {
    return null;
  }
}

let app: App | null = null;

export function adminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }
  const sa = loadServiceAccount();
  if (!sa) {
    throw new Error(
      "Firebase Admin credentials missing. Set FIREBASE_SERVICE_ACCOUNT_JSON or place serviceAccountKey.json in the project root."
    );
  }
  app = initializeApp({ credential: cert(sa as any) });
  return app;
}

export const adminAuth = () => getAuth(adminApp());

let db: ReturnType<typeof getFirestore> | null = null;
export function adminDb() {
  if (!db) {
    db = getFirestore(adminApp());
    // Result objects can carry undefined optional fields; don't reject them.
    // settings() throws if the Firestore instance was already configured by
    // another route module (or HMR in dev) — harmless, so swallow it.
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      /* already configured */
    }
  }
  return db;
}
