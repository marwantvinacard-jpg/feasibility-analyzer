"use client";

// Firebase-backed session — real authentication (email/password + Google) with
// the user profile/status/credits stored in Firestore and streamed live via
// onSnapshot. Same `useSession()` shape the UI already uses, so pages barely
// change. Replaces the localStorage mock in lib/session.tsx.

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
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { getFirebase } from "./client";

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
}

interface SessionCtx {
  ready: boolean;
  user: Account | null;
  signUpEmail: (name: string, email: string, password: string) => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setKeyMode: (mode: Account["keyMode"]) => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

/** Shape stored in Firestore users/{uid}. */
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

  useEffect(() => {
    const fb = getFirebase();
    if (!fb) {
      // Firebase not configured — surface as "ready, signed out" so the UI still renders.
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
      // Live-stream the user's profile doc.
      docUnsub.current = onSnapshot(
        ref,
        async (snap) => {
          if (!snap.exists()) {
            // First Google sign-in with no profile yet → create a pending one.
            try {
              await setDoc(ref, newUserDoc(u.displayName ?? "", u.email ?? ""));
            } catch {
              /* rules may race; the next snapshot will catch it */
            }
            return;
          }
          const d = snap.data() as any;
          setAccount({
            uid: u.uid,
            email: u.email ?? d.email ?? "",
            name: d.name ?? u.displayName ?? "",
            status: d.status ?? "pending",
            role: d.role ?? "user",
            credits: d.credits ?? 0,
            keyMode: d.keyMode ?? "platform",
          });
          setReady(true);
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
      async signUpEmail(name, email, password) {
        const fb = getFirebase();
        if (!fb) throw new Error("Firebase is not configured.");
        const cred = await createUserWithEmailAndPassword(fb.auth, email, password);
        if (name) await updateProfile(cred.user, { displayName: name });
        await setDoc(doc(fb.db, "users", cred.user.uid), newUserDoc(name, email));
      },
      async signInEmail(email, password) {
        const fb = getFirebase();
        if (!fb) throw new Error("Firebase is not configured.");
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
