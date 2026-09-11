"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { friendlyAuthError } from "@/lib/authErrors";
import { USERNAME_RE } from "@/lib/firebase/usernames";
import { useT } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function SignupPage() {
  const { signUpEmail, signInGoogle } = useSession();
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!USERNAME_RE.test(username.trim().toLowerCase())) {
      setError(t("auth.usernameInvalid"));
      return;
    }
    setBusy(true);
    try {
      await signUpEmail(name, username, email, password);
      router.push("/pending");
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  async function google() {
    setError("");
    setBusy(true);
    try {
      await signInGoogle();
      router.push("/pending");
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.signupTitle")}
      subtitle={t("auth.signupSubtitle")}
      topRight={<LanguageSwitcher />}
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">{t("auth.logIn")}</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("auth.nameLabel")}</label>
          <input className="input" placeholder={t("auth.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("auth.usernameLabel")}</label>
          <input className="input" placeholder={t("auth.usernamePlaceholder")} value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("auth.workEmail")}</label>
          <input className="input" type="email" placeholder={t("auth.emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">{t("auth.passwordLabel")}</label>
          <input className="input" type="password" placeholder={t("auth.minChars")} value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
        </div>
        {error && <p className="text-sm text-stop">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? t("auth.creatingAccount") : <>{t("auth.createAccount")} <Icon name="arrow" size={17} /></>}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-border" /> {t("auth.orContinueWith")} <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="ghost" className="w-full" onClick={google} disabled={busy}>{t("auth.continueWithGoogle")}</Button>

      <p className="mt-4 text-center text-xs text-faint">{t("auth.reviewNotice")}</p>
    </AuthShell>
  );
}
