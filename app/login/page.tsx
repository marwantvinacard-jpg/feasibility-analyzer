"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/kit";
import { useSession } from "@/lib/session";

export default function LoginPage() {
  const { login } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const acct = login(email);
    if (!acct) {
      setError("No account with that email. Try a demo account below, or sign up.");
      return;
    }
    if (acct.role === "admin") router.push("/admin");
    else if (acct.status === "approved") router.push("/app");
    else router.push("/pending");
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to run and view your feasibility reports."
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="font-semibold text-brand hover:underline">Create an account</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Email</label>
          <input
            className="input"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-stop">{error}</p>}
        <Button type="submit" className="w-full">Log in</Button>
      </form>

      <div className="mt-6 rounded-xl border border-border bg-surface-2 p-3 text-xs text-muted">
        <div className="mb-1.5 font-semibold text-ink">Demo accounts (concept build)</div>
        <button className="block hover:text-brand" onClick={() => setEmail("demo@feasibility.ai")}>
          • demo@feasibility.ai — approved user
        </button>
        <button className="block hover:text-brand" onClick={() => setEmail("admin@feasibility.ai")}>
          • admin@feasibility.ai — admin panel
        </button>
      </div>
    </AuthShell>
  );
}
