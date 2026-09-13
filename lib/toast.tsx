"use client";

// App-wide toast notifications. Mounted once in app/providers.tsx; call
// useToast() anywhere client-side to fire one. Auto-dismisses; screen readers
// get the message via a shared aria-live region so async actions (save,
// delete, error) are announced instead of failing silently.

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/ui";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastCtx {
  show: (message: string, kind?: ToastKind) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

const KIND_ICON: Record<ToastKind, IconName> = { success: "check", error: "x", info: "risk" };
const KIND_CLASS: Record<ToastKind, string> = {
  success: "border-go/30 bg-go/10 text-go",
  error: "border-stop/30 bg-stop/10 text-stop",
  info: "border-border bg-surface-2 text-ink",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur",
              KIND_CLASS[t.kind]
            )}
          >
            <Icon name={KIND_ICON[t.kind]} size={16} strokeWidth={2.5} />
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
