"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/kit";
import { useSession } from "@/lib/session";

export default function PendingPage() {
  const { user, ready, setStatus, logout } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
    if (ready && user?.status === "approved") router.replace("/app");
  }, [ready, user, router]);

  if (!ready || !user) return null;

  return (
    <AuthShell
      title="You're on the list"
      subtitle={`Thanks, ${user.name}. Your account is under review.`}
    >
      <div className="space-y-4 text-sm text-muted">
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center gap-2 font-medium text-ink">
            <span className="h-2 w-2 animate-pulse rounded-full bg-warn" /> Awaiting admin approval
          </div>
          <p className="mt-2">
            An administrator will review your account shortly. You'll get access to run feasibility
            reports as soon as you're approved — we'll email you at{" "}
            <span className="text-ink">{user.email}</span>.
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4">
          <div className="font-semibold text-ink">Concept build shortcut</div>
          <p className="mt-1 text-xs">
            In the real app, an admin approves you from the admin panel. To walk the flow now, you
            can self-approve:
          </p>
          <Button className="mt-3 w-full" onClick={() => { setStatus(user.uid, "approved"); router.push("/app"); }}>
            Approve me &amp; continue →
          </Button>
        </div>

        <button onClick={() => { logout(); router.push("/"); }} className="w-full text-center text-xs text-faint hover:text-muted">
          Sign out
        </button>
      </div>
    </AuthShell>
  );
}
