"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Brand";
import { Badge } from "@/components/kit";
import { Icon, type IconName } from "@/components/icons";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSession } from "@/lib/session";
import { useT } from "@/lib/i18n/LanguageContext";
import { cn } from "@/lib/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, user, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();

  const NAV: { href: string; label: string; icon: IconName }[] = [
    { href: "/app", label: t("nav.dashboard"), icon: "grid" },
    { href: "/app/new", label: t("nav.newAnalysis"), icon: "plus" },
    { href: "/app/settings", label: t("nav.settings"), icon: "sliders" },
  ];

  const WORKSPACE_NAV: { href: string; label: string; icon: IconName }[] = [
    { href: "/app/org", label: t("nav.organization"), icon: "building" },
    { href: "/app/team", label: t("nav.team"), icon: "user" },
    { href: "/app/benchmarks", label: t("nav.benchmarks"), icon: "chart" },
    { href: "/app/api-access", label: t("nav.apiAccess"), icon: "key" },
    { href: "/app/legal", label: t("nav.legal"), icon: "legal" },
  ];

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (user.status !== "approved") router.replace("/pending");
  }, [ready, user, router]);

  if (!ready || !user || user.status !== "approved") {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted">
        <div className="animate-pulse">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface/40 p-4 md:flex">
        <div className="px-2 py-2"><Logo href="/app" /></div>
        <nav className="mt-6 space-y-1">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active ? "bg-brand/10 text-brand" : "text-muted hover:bg-surface-2 hover:text-ink"
                )}
              >
                <Icon name={n.icon} size={18} />
                {n.label}
              </Link>
            );
          })}
          {user.role === "admin" && (
            <Link href="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-ink">
              <Icon name="star" size={18} /> {t("nav.admin")}
            </Link>
          )}
        </nav>

        <div className="mt-6 space-y-1">
          <div className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-faint">{t("nav.workspace")}</div>
          <nav className="mt-1.5 space-y-1">
            {WORKSPACE_NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                    active ? "bg-brand/10 text-brand" : "text-muted hover:bg-surface-2 hover:text-ink"
                  )}
                >
                  <Icon name={n.icon} size={18} />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <LanguageSwitcher className="[&>button]:w-full [&>button]:justify-center" />
            <ThemeToggle className="[&>button]:w-full [&>button]:justify-center" />
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-3.5">
            <div className="label">{t("dashboard.creditsRemaining")}</div>
            <div className="num mt-1 text-2xl font-semibold text-brand">{user.credits}</div>
          </div>
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted"><Icon name="user" size={16} /></span>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{user.name}</div>
                <div className="truncate text-xs text-faint">{user.email}</div>
              </div>
            </div>
            <button onClick={() => { logout(); router.push("/"); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint transition hover:bg-surface-2 hover:text-stop" aria-label="Sign out">
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-col">
        <header className="flex items-center justify-between border-b border-border px-5 py-3 md:hidden">
          <Logo href="/app" />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Badge tone="go"><span className="num">{user.credits}</span> {t("common.credits")}</Badge>
          </div>
        </header>
        <main className="flex-1 px-5 py-6 sm:px-8 sm:py-9">{children}</main>
      </div>
    </div>
  );
}
