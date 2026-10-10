"use client";

// Firebase-backed session — real authentication (email/password + Google) with
// the user profile/status/credits stored in Firestore and streamed live via
// onSnapshot.

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FbUser,
} from "firebase/auth";
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getFirebase } from "./client";
import { claimUsernameAndCreateProfile, sendPasswordResetFor, signInWithIdentifier } from "./usernames";

export type UserStatus = "pending" | "approved" | "rejected";
export type UserRole = "user" | "admin";

export interface Account {
  uid: string;
  email: string;
  name: string;
  status: UserStatus;
  role: UserRole;
  credits: number;
  keyMode: "platform" | "byok";
  /** True the very first time this account is ever seen signed in (no prior lastSeenAt). */
  isFirstSession: boolean;
  subscriptionStatus?: string;
  /** UI language preference, synced across devices once signed in. */
  language?: "en" | "ar" | "fr";
  /** Org workspace this account belongs to, if any (see lib/orgTypes.ts). */
  orgId?: string;
  /** True if this account has opted out of having its analyses used for model training. */
  trainingOptOut?: boolean;
  /** Firebase Auth's own verified flag (Google sign-ins are verified from the start). */
  emailVerified: boolean;
  /** Set (server-side) when a bring-your-own-key is stored — the key itself never reaches the browser. */
  byokProvider?: string;
  byokLast4?: string;
}

/** Outcome of asking the server to activate a pending account (see /api/account/activate). */
export type ActivationResult = "approved" | "needs-verification" | "manual" | "rejected";

interface SessionCtx {
  ready: boolean;
  user: Account | null;
  /** `termsVersion`: the Terms/Privacy version the user accepted (LEGAL.version). */
  signUpEmail: (name: string, username: string, email: string, password: string, termsVersion: string) => Promise<void>;
  signInEmail: (identifier: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setKeyMode: (mode: Account["keyMode"]) => Promise<void>;
  setLanguage: (lang: NonNullable<Account["language"]>) => Promise<void>;
  setTrainingOptOut: (optOut: boolean) => Promise<void>;
  getIdToken: () => Promise<string>;
  refreshClaims: () => Promise<void>;
  /** Emails a password-reset link. Resolves quietly when no such account exists. */
  sendPasswordReset: (identifier: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  /** Records that the signed-in user accepted the Terms/Privacy (set once; used after Google signup). */
  acceptTerms: (termsVersion: string) => Promise<void>;
  /** Re-checks email verification and, if verified, auto-approves the account. */
  activateAccount: () => Promise<ActivationResult>;
}

const Ctx = createContext<SessionCtx | null>(null);

function newUserDoc(name: string, email: string) {
  return {
    email,
    name: name || email.split("@")[0],
    status: "pending" as UserStatus,
    role: "user" as UserRole,
    credits: 0, // granted on approval (rules require 0 at creation)
    keyMode: "platform" as const,
    createdAt: new Date().toISOString(),
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [fbUser, setFbUser] = useState<FbUser | null>(null);
  const [ready, setReady] = useState(false);
  const docUnsub = useRef<(() => void) | null>(null);
  const touchedUid = useRef<string | null>(null);
  const firstSessionCache = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) {
      setReady(true);
      return;
    }

    const authUnsub = onAuthStateChanged(fb.auth, async (u) => {
      docUnsub.current?.();
      docUnsub.current = null;
      setFbUser(u);

      if (!u) {
        setAccount(null);
        setReady(true);
        return;
      }

      const ref = doc(fb.db, "users", u.uid);
      docUnsub.current = onSnapshot(
        ref,
        async (snap) => {
          if (!snap.exists()) {
            try {
              await setDoc(ref, newUserDoc(u.displayName ?? "", u.email ?? ""));
            } catch {
              /* rules may race; the next snapshot will catch it */
            }
            return;
          }
          const d = snap.data() as any;
          // Compute isFirstSession ONCE per uid, from the first snapshot we ever see
          // for it. Our own lastSeenAt write below echoes back through this same
          // listener a moment later — recomputing from that live doc would flip a
          // real "first session" to "returning" mid-render. Cache it instead.
          if (!(u.uid in firstSessionCache.current)) firstSessionCache.current[u.uid] = !d.lastSeenAt;
          const isFirstSession = firstSessionCache.current[u.uid];
          setAccount({
            uid: u.uid,
            email: u.email ?? d.email ?? "",
            name: d.name ?? u.displayName ?? "",
            status: d.status ?? "pending",
            role: d.role ?? "user",
            credits: d.credits ?? 0,
            keyMode: d.keyMode ?? "platform",
            isFirstSession,
            subscriptionStatus: d.subscriptionStatus,
            language: d.language,
            orgId: d.orgId,
            // Opt-in: "never chose" shows (and behaves) as opted out.
            trainingOptOut: d.trainingOptOut !== false,
            emailVerified: u.emailVerified,
            byokProvider: d.byokProvider,
            byokLast4: d.byokLast4,
          });
          setReady(true);

          // Record this visit exactly once per mount, after read — never before,
          // so isFirstSession above reflects state BEFORE this visit.
          if (touchedUid.current !== u.uid && d.status === "approved") {
            touchedUid.current = u.uid;
            updateDoc(ref, {
              lastSeenAt: serverTimestamp(),
              ...(isFirstSession ? { firstSeenAt: serverTimestamp() } : {}),
            }).catch(() => {});
          }
        },
        () => setReady(true)
      );
    });

    return () => {
      authUnsub();
      docUnsub.current?.();
    };
  }, []);

  const api = useMemo<SessionCtx>(
    () => ({
      ready,
      user: account,
      async signUpEmail(name, username, email, password, termsVersion) {
        const fb = getFirebase();
        if (!fb) throw new Error("Firebase is not configured.");
        const cred = await createUserWithEmailAndPassword(fb.auth, email, password);
        if (name) await updateProfile(cred.user, { displayName: name });
        await cred.user.getIdToken(true); // ensure the auth token is live for the rules check
        // The profile email is the one Firebase Auth holds for this account (the
        // rules require it to match the signed-in token), and the terms the user
        // ticked are recorded with the version they accepted.
        await claimUsernameAndCreateProfile(cred.user.uid, username, {
          ...newUserDoc(name, cred.user.email ?? email),
          termsAcceptedAt: serverTimestamp(),
          termsVersion,
        });
        // Verifying the email is what activates the account (see /api/account/activate).
        await sendEmailVerification(cred.user).catch(() => {});
      },
      async signInEmail(identifier, password) {
        const fb = getFirebase();
        if (!fb) throw new Error("Firebase is not configured.");
        // A username is checked server-side, so its email never reaches the browser.
        await signInWithIdentifier(fb.auth, identifier, password);
      },
      async signInGoogle() {
        const fb = getFirebase();
        if (!fb) throw new Error("Firebase is not configured.");
        await signInWithPopup(fb.auth, new GoogleAuthProvider());
      },
      async logout() {
        const fb = getFirebase();
        if (fb) await signOut(fb.auth);
      },
      async setKeyMode(mode) {
        const fb = getFirebase();
        if (!fb || !fbUser) return;
        await updateDoc(doc(fb.db, "users", fbUser.uid), { keyMode: mode });
      },
      async setLanguage(lang) {
        const fb = getFirebase();
        if (!fb || !fbUser) return;
        await updateDoc(doc(fb.db, "users", fbUser.uid), { language: lang });
      },
      async setTrainingOptOut(optOut) {
        const fb = getFirebase();
        if (!fb || !fbUser) return;
        await updateDoc(doc(fb.db, "users", fbUser.uid), { trainingOptOut: optOut });
      },
      async getIdToken() {
        if (!fbUser) throw new Error("Not signed in.");
        return fbUser.getIdToken();
      },
      async refreshClaims() {
        if (fbUser) await fbUser.getIdToken(true);
      },
      async sendPasswordReset(identifier) {
        const fb = getFirebase();
        if (!fb) throw new Error("Firebase is not configured.");
        await sendPasswordResetFor(fb.auth, identifier);
      },
      async acceptTerms(termsVersion) {
        const fb = getFirebase();
        if (!fb || !fbUser) return;
        await updateDoc(doc(fb.db, "users", fbUser.uid), { termsAcceptedAt: serverTimestamp(), termsVersion }).catch(() => {
          /* already recorded (the rules allow it once) */
        });
      },
      async resendVerification() {
        if (!fbUser) throw new Error("Not signed in.");
        await sendEmailVerification(fbUser);
      },
      async activateAccount() {
        if (!fbUser) throw new Error("Not signed in.");
        // Pick up a verification done in another tab/device, and get a token
        // whose email_verified claim reflects it.
        await fbUser.reload();
        const token = await fbUser.getIdToken(true);
        const verified = fbUser.emailVerified;
        setAccount((prev) => (prev && prev.emailVerified !== verified ? { ...prev, emailVerified: verified } : prev));
        const res = await fetch("/api/account/activate", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        const data = (await res.json().catch(() => ({}))) as { result?: ActivationResult; error?: string };
        if (!data.result) throw new Error(data.error ?? `Request failed (${res.status})`);
        return data.result;
      },
    }),
    [ready, account, fbUser]
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
