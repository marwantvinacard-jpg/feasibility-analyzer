"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/kit";
import { useSession } from "@/lib/session";
import { friendlyAuthError } from "@/lib/authErrors";
import { useT } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// Self-service password reset. Firebase Auth sends the reset email itself, so
// this works without the app's own email provider being configured.
export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useSession();
  const t = useT();
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await sendPasswordReset(identifier);
      setSent(true); // same message whether or not the account exists
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.forgotTitle")}
      subtitle={t("auth.forgotSubtitle")}
      topRight={<LanguageSwitcher />}
      footer={<Link href="/login" className="font-semibold text-brand hover:underline">{t("auth.backToLogin")}</Link>}
    >
      {sent ? (
        <p className="py-4 text-center text-sm text-muted">{t("auth.forgotSent")}</p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t("auth.identifierLabel")}</label>
            <input
              className="input"
              type="text"
              placeholder={t("auth.identifierPlaceholder")}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-stop">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !identifier.trim()}>
            {busy ? t("auth.forgotSending") : t("auth.forgotSend")}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
