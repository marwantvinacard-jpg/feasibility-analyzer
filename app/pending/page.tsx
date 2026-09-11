"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";

export default function PendingPage() {
  const { user, ready, logout } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (user.status === "approved") router.replace("/app");
  }, [ready, user, router]);

  if (!ready || !user || user.status === "approved") return null;
  const rejected = user.status === "rejected";

  return (
    <AuthShell
      title={rejected ? "Account not approved" : "Almost there"}
      subtitle={rejected ? `Sorry, ${user.name} — your account wasn't approved.` : `Thanks, ${user.name}. Your account is under review.`}
    >
      <div className="flex flex-col items-center py-4 text-center">
        <span className={`grid h-14 w-14 place-items-center rounded-2xl ${rejected ? "bg-stop/12 text-stop" : "bg-warn/12 text-warn"}`}>
          <Icon name={rejected ? "x" : "clock"} size={26} />
        </span>
        <p className="mt-4 text-sm text-muted">
          {rejected
            ? "Reach out if you think this is a mistake."
            : <>An administrator will review your account shortly. This page updates automatically the moment you're approved — no need to refresh. You're signed in as <span className="text-ink">{user.email}</span>.</>}
        </p>
        <button onClick={() => logout()} className="mt-6 text-sm text-faint hover:text-ink">Sign out</button>
      </div>
    </AuthShell>
  );
}
