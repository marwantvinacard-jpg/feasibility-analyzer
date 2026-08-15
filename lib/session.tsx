"use client";

// Mock auth + accounts, entirely client-side (localStorage). This stands in for
// Firebase Auth + the `users` collection so the ENTIRE product flow — signup →
// pending → admin approval → app access → credits → admin panel — is fully
// demoable on the dev server with no backend. It is deliberately swappable:
// every screen calls these hooks, so wiring Firebase later is a drop-in.

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type UserStatus = "pending" | "approved" | "rejected";
export type UserRole = "user" | "admin";

export interface Account {
  uid: string;
  email: string;
  name: string;
  status: UserStatus;
  role: UserRole;
  credits: number;
  createdAt: number;
  keyMode: "platform" | "byok";
}

const USERS_KEY = "fai_users";
const CURRENT_KEY = "fai_current";
const FREE_CREDITS = 3;

function seed(): Account[] {
  return [
    {
      uid: "admin",
      email: "admin@feasibility.ai",
      name: "Admin",
      status: "approved",
      role: "admin",
      credits: 999,
      createdAt: Date.now(),
      keyMode: "platform",
    },
    {
      uid: "demo",
      email: "demo@feasibility.ai",
      name: "Demo Founder",
      status: "approved",
      role: "user",
      credits: FREE_CREDITS,
      createdAt: Date.now(),
      keyMode: "platform",
    },
  ];
}

function load(): Account[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(USERS_KEY, JSON.stringify(s));
      return s;
    }
    return JSON.parse(raw);
  } catch {
    return seed();
  }
}

function save(users: Account[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

interface SessionCtx {
  ready: boolean;
  user: Account | null;
  users: Account[];
  signup: (email: string, name: string) => Account;
  login: (email: string) => Account | null;
  logout: () => void;
  setStatus: (uid: string, status: UserStatus) => void;
  grantCredits: (uid: string, n: number) => void;
  spendCredit: (uid: string) => void;
  setKeyMode: (uid: string, mode: Account["keyMode"]) => void;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<Account[]>([]);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUsers(load());
    setCurrentUid(localStorage.getItem(CURRENT_KEY));
    setReady(true);
  }, []);

  function persist(next: Account[]) {
    setUsers(next);
    save(next);
  }

  const api = useMemo<SessionCtx>(() => {
    const uidFrom = (email: string) => email.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
    return {
      ready,
      users,
      user: users.find((u) => u.uid === currentUid) ?? null,
      signup(email, name) {
        const uid = uidFrom(email);
        const existing = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (existing) {
          localStorage.setItem(CURRENT_KEY, existing.uid);
          setCurrentUid(existing.uid);
          return existing;
        }
        const acct: Account = {
          uid,
          email: email.trim(),
          name: name.trim() || email.split("@")[0],
          status: "pending",
          role: "user",
          credits: FREE_CREDITS,
          createdAt: Date.now(),
          keyMode: "platform",
        };
        persist([...users, acct]);
        localStorage.setItem(CURRENT_KEY, uid);
        setCurrentUid(uid);
        return acct;
      },
      login(email) {
        const acct = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!acct) return null;
        localStorage.setItem(CURRENT_KEY, acct.uid);
        setCurrentUid(acct.uid);
        return acct;
      },
      logout() {
        localStorage.removeItem(CURRENT_KEY);
        setCurrentUid(null);
      },
      setStatus(uid, status) {
        persist(users.map((u) => (u.uid === uid ? { ...u, status } : u)));
      },
      grantCredits(uid, n) {
        persist(users.map((u) => (u.uid === uid ? { ...u, credits: u.credits + n } : u)));
      },
      spendCredit(uid) {
        persist(users.map((u) => (u.uid === uid ? { ...u, credits: Math.max(0, u.credits - 1) } : u)));
      },
      setKeyMode(uid, mode) {
        persist(users.map((u) => (u.uid === uid ? { ...u, keyMode: mode } : u)));
      },
    };
  }, [users, currentUid, ready]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
