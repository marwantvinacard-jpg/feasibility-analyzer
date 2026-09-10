"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Brand";
import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/ui";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/app", label: "Dashboard", icon: "grid" },
  { href: "/app/new", label: "New analysis", icon: "plus" },
  { href: "/app/settings", label: "Settings", icon: "sliders" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[256px_1fr]">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface/40 p-4 md:flex">
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

        <div className="mt-auto px-1">
          <Link href="/" className="flex items-center gap-2.5 text-sm text-faint transition hover:text-ink">
            <Icon name="arrow" size={15} className="rotate-180" /> Back to site
          </Link>
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="flex flex-col">
        <header className="flex items-center justify-between border-b border-border px-5 py-3 md:hidden">
          <Logo href="/app" />
        </header>
        <main className="flex-1 px-5 py-6 sm:px-8 sm:py-9">{children}</main>
      </div>
    </div>
  );
}
