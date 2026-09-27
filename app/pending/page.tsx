"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { useT } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function PendingPage() {
  const { user, ready, logout, getIdToken, checkEmailVerified, resendVerificationEmail } = useSession();
  const t = useT();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (user.status === "approved") router.replace("/app");
  }, [ready, user, router]);

  // A signup that's already email-verified (every Google sign-in, or an
  // email/password one that clicked the link before landing here) gets
  // approved automatically on arrival — no need to even see the button.
  useEffect(() => {
    if (ready && user?.status === "pending" && user.emailVerified) checkNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.status, user?.emailVerified]);

  async function checkNow() {
    setChecking(true);
    setCheckError("");
    try {
      const verified = await checkEmailVerified();
      if (verified) {
        const token = await getIdToken();
        const res = await fetch("/api/account/auto-approve", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Could not approve your account yet.");
        }
        // The account doc's onSnapshot listener picks up the status change
        // and the redirect effect above fires — no need to navigate here.
      } else {
        setCheckError(t("auth.notVerifiedYet"));
      }
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : "Something went wrong — try again.");
    } finally {
      setChecking(false);
    }
  }

  if (!ready || !user || user.status === "approved") return null;
  const rejected = user.status === "rejected";

  return (
    <AuthShell
      title={rejected ? t("auth.rejectedTitle") : t("auth.almostTitle")}
      subtitle={rejected ? t("auth.rejectedBody", { name: user.name }) : t("auth.almostBody", { name: user.name })}
      topRight={<LanguageSwitcher />}
    >
      <div className="flex flex-col items-center py-4 text-center">
        <span className={`grid h-14 w-14 place-items-center rounded-2xl ${rejected ? "bg-stop/12 text-stop" : "bg-warn/12 text-warn"}`}>
          <Icon name={rejected ? "x" : "clock"} size={26} />
        </span>
        <p className="mt-4 text-sm text-muted">
          {rejected ? t("auth.rejectedNote") : t("auth.pendingNote", { email: user.email })}
        </p>

        {!rejected && (
          <>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button onClick={checkNow} disabled={checking}>
                {checking ? t("auth.checking") : t("auth.iVerified")}
              </Button>
              <Button
                variant="ghost"
                disabled={resent}
                onClick={async () => {
                  await resendVerificationEmail().catch(() => {});
                  setResent(true);
                }}
              >
                {resent ? t("auth.emailResent") : t("auth.resendEmail")}
              </Button>
            </div>
            {checkError && <p className="mt-3 text-sm text-stop">{checkError}</p>}
          </>
        )}

        <button onClick={() => logout()} className="mt-6 text-sm text-faint hover:text-ink">{t("auth.signOut")}</button>
      </div>
    </AuthShell>
  );
}
