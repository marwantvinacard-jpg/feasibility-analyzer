"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LANGUAGES } from "@/lib/i18n/translations";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/ui";
import { useSession } from "@/lib/session";

/** Globe button + dropdown to switch the app's language (EN/AR/FR). */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useLanguage();
  const { user, setLanguage: persistLanguage } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-ink"
        aria-label="Change language"
      >
        <Icon name="globe" size={15} />
        {current.nativeLabel}
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-1.5 min-w-[9rem] overflow-hidden rounded-xl border border-border bg-surface shadow-lift">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
                if (user) persistLanguage(l.code).catch(() => {});
              }}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-start text-sm transition-colors hover:bg-surface-2",
                l.code === lang ? "font-semibold text-brand" : "text-muted"
              )}
            >
              {l.nativeLabel}
              {l.code === lang && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
