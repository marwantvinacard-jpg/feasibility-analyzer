"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme, type ThemeChoice } from "@/lib/theme";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/ui";

const OPTIONS: { key: ThemeChoice; label: string; icon: IconName }[] = [
  { key: "system", label: "System", icon: "sliders" },
  { key: "light", label: "Light", icon: "sun" },
  { key: "dark", label: "Dark", icon: "moon" },
];

/** Cycles through system → light → dark, matching the LanguageSwitcher's look. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
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

  const current = OPTIONS.find((o) => o.key === theme) ?? OPTIONS[0];

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-ink"
        aria-label="Change theme"
      >
        <Icon name={current.icon} size={15} />
        {current.label}
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-1.5 min-w-[8rem] overflow-hidden rounded-xl border border-border bg-surface shadow-lift">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => {
                setTheme(o.key);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition-colors hover:bg-surface-2",
                o.key === theme ? "font-semibold text-brand" : "text-muted"
              )}
            >
              <Icon name={o.icon} size={15} /> {o.label}
              {o.key === theme && <Icon name="check" size={14} className="ms-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
