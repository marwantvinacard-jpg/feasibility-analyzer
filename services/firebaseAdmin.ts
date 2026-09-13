import admin from "firebase-admin";

/**
 * Initializes firebase-admin once for the whole server process.
 *
 * Credential resolution order:
 *  1. FIREBASE_SERVICE_ACCOUNT  -> full service-account JSON (string) [local dev]
 *  2. GOOGLE_APPLICATION_CREDENTIALS -> path to a JSON file (handled by ADC)
 *  3. Application Default Credentials (Cloud Run / GCP)  [production]
 */
function initAdmin(): admin.app.App {
  if (admin.apps.length) return admin.app();

  const bucket = process.env.FIREBASE_STORAGE_BUCKET;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (raw) {
    let parsed: admin.ServiceAccount;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON: " +
          (e as Error).message
      );
    }
    return admin.initializeApp({
      credential: admin.credential.cert(parsed),
      storageBucket: bucket,
    });
  }

  // Application Default Credentials (Cloud Run, or GOOGLE_APPLICATION_CREDENTIALS)
  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: bucket,
  });
}

const app = initAdmin();

export const adminAuth = app.auth();
export const db = app.firestore();
export const bucket = app.storage().bucket();

export type UserStatus = "pending" | "active" | "disabled";
export type UserRole = "user" | "admin";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  status: UserStatus;
  role: UserRole;
  hasApiKey: boolean;
  generationCount: number;
  createdAt: FirebaseFirestore.Timestamp | null;
  lastLoginAt: FirebaseFirestore.Timestamp | null;
}

// Fail closed: if SUPER_ADMIN_EMAIL is not set, NO account is auto-provisioned
// as admin. Set it explicitly in every environment (.env.local, Cloud Run,
// Functions). Never hardcode a live personal address in source.
export const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || "")
  .trim()
  .toLowerCase();

export { admin };
