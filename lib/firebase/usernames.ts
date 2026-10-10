"use client";

// Usernames. Firebase Auth has no native usernames, so usernames/{username}
// maps a username to its account: { uid } — and nothing else.
//
// It used to store { uid, email } and be publicly readable, so anyone who
// guessed a username got that person's email address. Now the browser never
// learns another account's email: logging in or resetting a password with a
// username goes through the server (/api/auth/username-login and
// /api/auth/username-reset), which looks the email up itself.

import { doc, getDoc, runTransaction } from "firebase/firestore";
import { sendPasswordResetEmail, signInWithCustomToken, signInWithEmailAndPassword, type Auth } from "firebase/auth";
import { getFirebase } from "./client";

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}
export function looksLikeEmail(id: string): boolean {
  return id.includes("@");
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

/**
 * Signs in with an email OR a username. For a username the server checks the
 * password and returns a one-time sign-in token — the email never reaches the
 * browser. Errors carry Firebase-style codes for the login page's messages.
 */
export async function signInWithIdentifier(auth: Auth, identifier: string, password: string): Promise<void> {
  const id = identifier.trim();
  if (looksLikeEmail(id)) {
    await signInWithEmailAndPassword(auth, id, password);
    return;
  }
  const r = await postJson("/api/auth/username-login", { username: normalizeUsername(id), password });
  if (!r.ok) {
    const code = r.status === 429 ? "auth/too-many-requests" : r.status === 401 ? "auth/invalid-credential" : "auth/internal-error";
    throw Object.assign(new Error(r.data.error ?? "Sign-in failed."), { code });
  }
  await signInWithCustomToken(auth, r.data.customToken);
}

/**
 * Emails a password-reset link for an email or username. Resolves the same way
 * whether or not the account exists, so the form can't be used to find out
 * which emails/usernames are registered. Firebase Auth sends the email itself.
 */
export async function sendPasswordResetFor(auth: Auth, identifier: string): Promise<void> {
  const id = identifier.trim();
  if (looksLikeEmail(id)) {
    await sendPasswordResetEmail(auth, id).catch((e) => {
      if (!String((e as { code?: string })?.code ?? "").includes("user-not-found")) throw e;
    });
    return;
  }
  const r = await postJson("/api/auth/username-reset", { username: normalizeUsername(id) });
  if (r.status === 429) throw Object.assign(new Error(r.data.error ?? "Too many attempts."), { code: "auth/too-many-requests" });
}

/** Claim `username` for `uid` + write the user profile doc, atomically. */
export async function claimUsernameAndCreateProfile(
  uid: string,
  username: string,
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
  const taken = () => Object.assign(new Error("That username is taken."), { code: "auth/username-already-in-use" });

  // A pre-migration usernames doc (one that still holds an email) is no longer
  // readable from the browser — which also means that username is taken.
  try {
    await getDoc(unameRef);
  } catch (e) {
    if (String((e as { code?: string })?.code ?? "").includes("permission-denied")) throw taken();
    throw e;
  }

  await runTransaction(fb.db, async (tx) => {
    const existing = await tx.get(unameRef);
    const userSnap = await tx.get(userRef);
    if (existing.exists() && existing.data()?.uid !== uid) throw taken();
    if (!existing.exists()) tx.set(unameRef, { uid });

    // Signup owns only these fields; the rules reject any other change.
    const signupFields = {
      username: uname,
      name: profile.name ?? userSnap.data()?.name ?? "",
      ...(profile.termsAcceptedAt ? { termsAcceptedAt: profile.termsAcceptedAt, termsVersion: profile.termsVersion } : {}),
    };
    if (!userSnap.exists()) {
      tx.set(userRef, { ...profile, username: uname });
    } else if (!userSnap.data()?.username) {
      // The session listener usually creates the profile first (it fires as
      // soon as the Auth user exists), so this is the common path.
      tx.update(userRef, signupFields);
    }
  });
}
