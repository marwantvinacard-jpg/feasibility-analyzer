"use client";

// No-auth session. The app has no login: every visitor is an anonymous "guest".
// A random clientId is kept in localStorage so each browser sees its own
// analyses (the server scopes reads/writes by it). The useSession() shape is
// unchanged so the rest of the app didn't need touching.

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
  keyMode: "platform" | "byok";
}

interface SessionCtx {
  ready: boolean;
  user: Account | null;
  logout: () => Promise<void>;
  setKeyMode: (mode: Account["keyMode"]) => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

const CLIENT_ID_KEY = "fa.clientId";

function readClientId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `c_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return "guest";
  }
}

/** The clientId for API calls (safe to call anywhere in the browser). */
export function getClientId(): string {
  return readClientId();
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string>("server");

  useEffect(() => {
    setUid(readClientId());
  }, []);

  const api = useMemo<SessionCtx>(() => {
    const user: Account = {
      uid,
      email: "",
      name: "Guest",
      status: "approved",
      role: "user",
      credits: Infinity,
      keyMode: "platform",
    };
    return {
      ready: uid !== "server",
      user,
      async logout() {},
      async setKeyMode() {},
      async refreshClaims() {},
    };
  }, [uid]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
