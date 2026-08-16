"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { useSession } from "@/lib/session";

export default function PendingPage() {
  const { user, ready, logout } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (user.status === "approved") router.replace("/app");
    else if (user.status === "rejected") { /* stay, show rejected */ }
  }, [ready, user, router]);

  if (!ready || !user) return null;

  const rejected = user.status === "rejected";

  return (
    <AuthShell
      title={rejected ? "Account not approved" : "You're on the list"}
      subtitle={rejected ? `Sorry, ${user.name} — your account wasn't approved.` : `Thanks, ${user.name}. Your account is under review.`}
    >
      <div className="space-y-4 text-sm text-muted">
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center gap-2 font-medium text-ink">
            <span className={`h-2 w-2 rounded-full ${rejected ? "bg-stop" : "animate-pulse bg-warn"}`} />
            {rejected ? "Access denied" : "Awaiting admin approval"}
          </div>
          <p className="mt-2">
            {rejected
              ? "If you think this is a mistake, reach out to the administrator."
              : <>An administrator will review your account shortly. This page updates automatically the moment you're approved — no need to refresh. You're signed in as <span className="text-ink">{user.email}</span>.</>}
          </p>
        </div>

        <button
          onClick={async () => { await logout(); router.push("/"); }}
          className="w-full text-center text-xs text-faint hover:text-muted"
        >
          Sign out
        </button>
      </div>
    </AuthShell>
  );
}
