"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { Button } from "@/components/kit";
import { useSession } from "@/lib/session";

export default function SignupPage() {
  const { signup } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    signup(email, name);
    router.push("/pending");
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
          <input
            className="input"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full">Create account →</Button>
        <p className="text-center text-xs text-faint">
          Accounts are reviewed by an admin before access is granted.
        </p>
      </form>
    </AuthShell>
  );
}
