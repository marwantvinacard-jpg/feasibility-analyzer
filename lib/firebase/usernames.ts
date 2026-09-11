"use client";

// Username -> email resolution for login. Firebase Auth has no native username
// support, so a small public map at usernames/{username} = { uid, email } lets
// the login page resolve a typed username to its real email BEFORE the user is
// authenticated, then sign in with that email. Stored lowercased.

import { doc, getDoc, runTransaction } from "firebase/firestore";
import { getFirebase } from "./client";

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}
export function looksLikeEmail(id: string): boolean {
  return id.includes("@");
}

/** Resolve a username to its account email, or throw an auth-style error. */
export async function resolveIdentifierToEmail(identifier: string): Promise<string> {
  const id = identifier.trim();
  if (looksLikeEmail(id)) return id;

  const uname = normalizeUsername(id);
  if (!USERNAME_RE.test(uname)) {
    throw Object.assign(new Error("No account with that username."), { code: "auth/user-not-found" });
  }
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase is not configured.");

  const snap = await getDoc(doc(fb.db, "usernames", uname));
  if (!snap.exists()) {
    throw Object.assign(new Error("No account with that username."), { code: "auth/user-not-found" });
  }
  return (snap.data() as { email: string }).email;
}

/** Claim `username` for `uid` + write the user profile doc, atomically. */
export async function claimUsernameAndCreateProfile(
  uid: string,
  username: string,
  email: string,
  profile: Record<string, unknown>
): Promise<void> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase is not configured.");

  const uname = normalizeUsername(username);
  if (!USERNAME_RE.test(uname)) {
    throw Object.assign(new Error("Username must be 3-20 chars: letters, numbers, underscore."), {
      code: "auth/invalid-username",
    });
  }

  const unameRef = doc(fb.db, "usernames", uname);
  const userRef = doc(fb.db, "users", uid);

  await runTransaction(fb.db, async (tx) => {
    const existing = await tx.get(unameRef);
    if (existing.exists() && existing.data()?.uid !== uid) {
      throw Object.assign(new Error("That username is taken."), { code: "auth/username-already-in-use" });
    }
    tx.set(unameRef, { uid, email });
    tx.set(userRef, { ...profile, username: uname }, { merge: true });
  });
}
