"use client";

// Firebase-backed session — real authentication (email/password + Google) with
// the user profile/status/credits stored in Firestore and streamed live via
// onSnapshot.

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FbUser,
} from "firebase/auth";
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getFirebase } from "./client";
import { claimUsernameAndCreateProfile, resolveIdentifierToEmail } from "./usernames";

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
}

interface SessionCtx {
  ready: boolean;
  user: Account | null;
  signUpEmail: (name: string, username: string, email: string, password: string) => Promise<void>;
  signInEmail: (identifier: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setKeyMode: (mode: Account["keyMode"]) => Promise<void>;
  setLanguage: (lang: NonNullable<Account["language"]>) => Promise<void>;
  setTrainingOptOut: (optOut: boolean) => Promise<void>;
  getIdToken: () => Promise<string>;
  refreshClaims: () => Promise<void>;
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
            trainingOptOut: d.trainingOptOut ?? false,
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
      async signUpEmail(name, username, email, password) {
        const fb = getFirebase();
        if (!fb) throw new Error("Firebase is not configured.");
        const cred = await createUserWithEmailAndPassword(fb.auth, email, password);
        if (name) await updateProfile(cred.user, { displayName: name });
        await cred.user.getIdToken(true); // ensure the auth token is live for the rules check
        await claimUsernameAndCreateProfile(cred.user.uid, username, email, newUserDoc(name, email));
      },
      async signInEmail(identifier, password) {
        const fb = getFirebase();
        if (!fb) throw new Error("Firebase is not configured.");
        const email = await resolveIdentifierToEmail(identifier);
        await signInWithEmailAndPassword(fb.auth, email, password);
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
