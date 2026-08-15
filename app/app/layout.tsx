"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Brand";
import { Badge } from "@/components/kit";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/ui";

const NAV = [
  { href: "/app", label: "Dashboard", icon: "▦" },
  { href: "/app/new", label: "New analysis", icon: "＋" },
  { href: "/app/settings", label: "Settings", icon: "⚙" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, user, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (user.status !== "approved") router.replace("/pending");
  }, [ready, user, router]);

  if (!ready || !user || user.status !== "approved") {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted">
        <div className="animate-pulse">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface/50 p-4 md:flex">
        <div className="px-2 py-2">
          <Logo href="/app" />
        </div>
        <nav className="mt-6 space-y-1">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                  active ? "bg-brand/12 text-brand" : "text-muted hover:bg-surface-2 hover:text-ink"
                )}
              >
                <span className="w-4 text-center">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
          {user.role === "admin" && (
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              <span className="w-4 text-center">★</span> Admin panel
            </Link>
          )}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="text-[0.7rem] text-faint">Credits remaining</div>
            <div className="text-xl font-bold text-brand">{user.credits}</div>
          </div>
          <div className="flex items-center justify-between px-1">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-xs text-faint">{user.email}</div>
            </div>
            <button onClick={() => { logout(); router.push("/"); }} className="text-xs text-faint hover:text-stop" title="Sign out">
              ⏻
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="flex flex-col">
        <header className="flex items-center justify-between border-b border-border px-5 py-3 md:hidden">
          <Logo href="/app" />
          <Badge tone="go">{user.credits} credits</Badge>
        </header>
        <main className="flex-1 px-5 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
