"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/kit";
import { useSession } from "@/lib/session";
import { friendlyAuthError } from "@/lib/authErrors";
import { useT } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function LoginPage() {
  const { signInEmail, signInGoogle } = useSession();
  const t = useT();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await fn();
      router.push("/app"); // the app guard routes pending -> /pending
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.loginTitle")}
      subtitle={t("auth.loginSubtitle")}
      topRight={<LanguageSwitcher />}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="font-semibold text-brand hover:underline">{t("auth.signUp")}</Link>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); run(() => signInEmail(identifier, password)); }} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("auth.identifierLabel")}</label>
          <input className="input" type="text" placeholder={t("auth.identifierPlaceholder")} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("auth.passwordLabel")}</label>
          <input className="input" type="password" placeholder={t("auth.passwordPlaceholder")} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-stop">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? t("auth.loggingIn") : t("auth.logIn")}</Button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-border" /> {t("auth.orContinueWith")} <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="ghost" className="w-full" onClick={() => run(signInGoogle)} disabled={busy}>{t("auth.continueWithGoogle")}</Button>
    </AuthShell>
  );
}
