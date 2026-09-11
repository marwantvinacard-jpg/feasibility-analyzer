"use client";

// App-wide language switch. Not URL-based (no /ar/... routes) — a single
// client-side preference, applied instantly via document.dir/lang and
// persisted to localStorage immediately, then synced to the user's Firestore
// profile in the background so it follows them across devices once signed in.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANG, DICTS, LANGUAGES, type Lang } from "./translations";

const STORAGE_KEY = "feasibility-lang";

interface LanguageCtx {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<LanguageCtx | null>(null);

function detectInitialLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored && LANGUAGES.some((l) => l.code === stored)) return stored;
  } catch {
    /* localStorage may be unavailable (private mode) */
  }
  const nav = window.navigator.language?.slice(0, 2).toLowerCase();
  if (nav === "ar" || nav === "fr") return nav;
  return DEFAULT_LANG;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // Resolve the real preference after mount only, so SSR and the first client
  // render match (avoids a hydration mismatch) — this repaints once, fast.
  useEffect(() => {
    setLangState(detectInitialLang());
  }, []);

  const dir = LANGUAGES.find((l) => l.code === lang)?.dir ?? "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = DICTS[lang] ?? DICTS[DEFAULT_LANG];
      let str = dict[key] ?? DICTS[DEFAULT_LANG][key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) str = str.replace(`{{${k}}}`, String(v));
      }
      return str;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, dir, setLang, t }), [lang, dir, setLang, t]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLanguage(): LanguageCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

/** Shorthand for components that only need the translator function. */
export function useT() {
  return useLanguage().t;
}
