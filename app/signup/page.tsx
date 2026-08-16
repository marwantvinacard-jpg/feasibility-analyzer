"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { friendlyAuthError } from "@/lib/authErrors";

export default function SignupPage() {
  const { signUpEmail, signInGoogle } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signUpEmail(name, email, password);
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
      title="Create your account"
      subtitle="Sign up, get approved, and start analyzing ideas."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand hover:underline">Log in</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Full name</label>
          <input className="input" placeholder="Jane Founder" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Work email</label>
          <input className="input" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Password</label>
          <input className="input" type="password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
        </div>
        {error && <p className="text-sm text-stop">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Creating…" : <>Create account <Icon name="arrow" size={17} /></>}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="ghost" className="w-full" onClick={google} disabled={busy}>Continue with Google</Button>

      <p className="mt-4 text-center text-xs text-faint">Accounts are reviewed by an admin before access is granted.</p>
    </AuthShell>
  );
}
