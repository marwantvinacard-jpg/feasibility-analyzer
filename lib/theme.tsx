"use client";

// Manual light/dark override on top of the OS-preference CSS already in
// globals.css (:root vs @media(prefers-color-scheme) vs [data-theme]).
// "system" removes the override entirely so the OS setting wins, matching
// how every token in globals.css is already structured.

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";
const STORAGE_KEY = "feasibility-theme";

interface ThemeCtx {
  theme: ThemeChoice;
  setTheme: (t: ThemeChoice) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function apply(theme: ThemeChoice) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeChoice>("system");

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as ThemeChoice | null) ?? "system";
    setThemeState(saved);
    apply(saved);
  }, []);

  function setTheme(t: ThemeChoice) {
    setThemeState(t);
    apply(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* private browsing etc — theme just won't persist across reloads */
    }
  }

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
