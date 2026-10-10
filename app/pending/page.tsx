"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { friendlyAuthError } from "@/lib/authErrors";
import { useT } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// A pending account lands here. With automatic approval (the default) it only
// needs a verified email: Google sign-ins go straight through, email/password
// signups verify via the link we emailed them. With SIGNUP_APPROVAL=manual the
// page falls back to "an admin will review your account".
type Mode = "checking" | "verify" | "manual";

export default function PendingPage() {
  const { user, ready, logout, activateAccount, resendVerification } = useSession();
  const t = useT();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("checking");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const triedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (user.status === "approved") router.replace("/app");
  }, [ready, user, router]);

  // Try to activate once as soon as we know who this is. On success the
  // session's live user doc flips to "approved" and the effect above redirects.
  useEffect(() => {
    if (!user || user.status !== "pending" || triedFor.current === user.uid) return;
    triedFor.current = user.uid;
    activateAccount()
      .then((r) => setMode(r === "needs-verification" ? "verify" : r === "manual" ? "manual" : "checking"))
      .catch(() => setMode("manual"));
  }, [user, activateAccount]);

  async function checkAgain() {
    setBusy(true);
    setNote("");
    try {
      const r = await activateAccount();
      if (r === "needs-verification") setNote(t("auth.verifyNotYet"));
      else if (r === "manual") setMode("manual");
    } catch (e) {
      setNote(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setNote("");
    try {
      await resendVerification();
      setNote(t("auth.verifyResent"));
    } catch (e) {
      setNote(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !user || user.status === "approved") return null;
  const rejected = user.status === "rejected";

  if (!rejected && mode === "checking") {
    return (
      <AuthShell title={t("auth.almostTitle")} subtitle="" topRight={<LanguageSwitcher />}>
        <p className="py-6 text-center text-sm text-muted">{t("common.loading")}</p>
      </AuthShell>
    );
  }

  if (!rejected && mode === "verify") {
    return (
      <AuthShell title={t("auth.verifyTitle")} subtitle={t("auth.verifyBody", { name: user.name })} topRight={<LanguageSwitcher />}>
        <div className="flex flex-col items-center py-4 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Icon name="check" size={26} />
          </span>
          <p className="mt-4 text-sm text-muted">{t("auth.verifyNote", { email: user.email })}</p>
          <Button className="mt-5 w-full" onClick={checkAgain} disabled={busy}>
            {busy ? t("auth.verifyChecking") : t("auth.verifyContinue")}
          </Button>
          <button onClick={resend} disabled={busy} className="mt-3 text-sm text-brand hover:underline">
            {t("auth.verifyResend")}
          </button>
          {note && <p className="mt-3 text-sm text-muted">{note}</p>}
          <button onClick={() => logout()} className="mt-6 text-sm text-faint hover:text-ink">{t("auth.signOut")}</button>
        </div>
      </AuthShell>
    );
  }

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
        <button onClick={() => logout()} className="mt-6 text-sm text-faint hover:text-ink">{t("auth.signOut")}</button>
      </div>
    </AuthShell>
  );
}
