// Shared test harness: provision Firebase users in any state and mint real
// Firebase ID tokens for them, so we can exercise the live API exactly as a
// browser client would — without going through the signup UI.
//
// Run test scripts with:  npx tsx test/<file>.ts   (from the project root)
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "node:fs";
import admin from "firebase-admin";

if (!admin.apps.length) {
  // Initialize with the service-account cert so createCustomToken() signs
  // locally with the private key (no IAM Credentials API dependency).
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./service-account.json";
  const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export const adminAuth = admin.auth();
export const db = admin.firestore();
export const bucket = admin.storage().bucket();
export const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const WEB_API_KEY = process.env.VITE_FIREBASE_API_KEY!;

export type Status = "pending" | "active" | "disabled";
export type Role = "user" | "admin";

export interface TestUser {
  uid: string;
  email: string;
  idToken: string;
}

/** Create (or reset) a user with a given profile state, return a fresh ID token. */
export async function makeUser(opts: {
  email: string;
  status?: Status;
  role?: Role;
  hasApiKey?: boolean;
}): Promise<TestUser> {
  const { email } = opts;
  // Ensure a clean auth user
  try {
    const existing = await adminAuth.getUserByEmail(email);
    await adminAuth.deleteUser(existing.uid);
  } catch {
    /* not found — fine */
  }
  const user = await adminAuth.createUser({
    email,
    password: "Test-" + Math.random().toString(36).slice(2, 10) + "!A",
    emailVerified: true,
  });

  await db.collection("users").doc(user.uid).set({
    email,
    displayName: email.split("@")[0],
    status: opts.status || "pending",
    role: opts.role || "user",
    hasApiKey: !!opts.hasApiKey,
    generationCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const idToken = await mintIdToken(user.uid);
  return { uid: user.uid, email, idToken };
}

/** Exchange a custom token for a real ID token via the Identity Toolkit REST API. */
export async function mintIdToken(uid: string): Promise<string> {
  const customToken = await adminAuth.createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!data.idToken)
    throw new Error("Failed to mint ID token: " + JSON.stringify(data));
  return data.idToken;
}

/** Authenticated fetch against the live API using an ID token. */
export async function api(
  token: string | null,
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as any),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

/** Delete a test user and all their data. */
export async function cleanup(uid: string) {
  try {
    await adminAuth.deleteUser(uid);
  } catch {}
  try {
    const gens = await db.collection(`users/${uid}/generations`).listDocuments();
    await Promise.all(gens.map((d) => d.delete()));
    const secret = await db.collection(`users/${uid}/secret`).listDocuments();
    await Promise.all(secret.map((d) => d.delete()));
    await db.doc(`users/${uid}`).delete();
  } catch {}
}

/** Tiny assertion helper that records results instead of throwing. */
export function makeChecker() {
  const results: { name: string; pass: boolean; detail: string }[] = [];
  const check = (name: string, pass: boolean, detail = "") => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  };
  const summary = () => {
    const failed = results.filter((r) => !r.pass);
    console.log(
      `\n${results.length - failed.length}/${results.length} passed` +
        (failed.length ? `, ${failed.length} FAILED` : " — ALL GREEN")
    );
    return { total: results.length, failed: failed.length, results };
  };
  return { check, summary };
}
