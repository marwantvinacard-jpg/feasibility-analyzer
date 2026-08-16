"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot } from "firebase/firestore";
import { Logo } from "@/components/Brand";
import { Badge, Button, Container } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { getFirebase } from "@/lib/firebase/client";
import { cn } from "@/lib/ui";

interface Row {
  uid: string;
  email: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  role: "user" | "admin";
  credits: number;
  createdAt?: string;
}

export default function AdminPage() {
  const { ready, user, logout } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (user.role !== "admin") router.replace("/app");
  }, [ready, user, router]);

  useEffect(() => {
    const fb = getFirebase();
    if (!fb || user?.role !== "admin") return;
    const unsub = onSnapshot(collection(fb.db, "users"), (snap) => {
      setRows(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Row, "uid">) })));
    }, (e) => setError(e.message));
    return () => unsub();
  }, [user?.role]);

  async function act(uid: string, action: "approve" | "reject" | "grant", amount?: number) {
    setError("");
    setBusy(uid + action);
    try {
      const fb = getFirebase();
      const token = await fb!.auth.currentUser!.getIdToken();
      const res = await fetch("/api/admin/user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid, action, amount }),
      });
      if (!res.ok) setError((await res.json()).error ?? "Action failed");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!ready || user?.role !== "admin") {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted">Loading…</div>;
  }

  const pending = rows.filter((u) => u.status === "pending");
  const others = rows.filter((u) => u.status !== "pending").sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-paper/80 backdrop-blur">
        <Container className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo href="/admin" />
            <Badge tone="stop">Admin</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button href="/app" variant="ghost" className="text-sm">Open app</Button>
            <button onClick={async () => { await logout(); router.push("/"); }} className="text-sm text-faint hover:text-stop">Sign out</button>
          </div>
        </Container>
      </header>

      <Container className="space-y-8 py-8">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">User management</h1>
          <p className="mt-1.5 text-sm text-muted">Approve new accounts and manage access. Updates live from Firestore.</p>
        </div>
        {error && <p className="text-sm text-stop">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Total users" value={rows.length} />
          <Stat label="Pending" value={pending.length} tone="warn" />
          <Stat label="Approved" value={rows.filter((u) => u.status === "approved").length} tone="go" />
          <Stat label="Rejected" value={rows.filter((u) => u.status === "rejected").length} tone="stop" />
        </div>

        <section>
          <h2 className="label mb-3">Pending approval</h2>
          {pending.length === 0 ? (
            <div className="card py-10 text-center text-sm text-muted">No accounts awaiting approval.</div>
          ) : (
            <div className="space-y-3">
              {pending.map((u) => (
                <div key={u.uid} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-muted"><Icon name="user" size={18} /></span>
                    <div>
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-xs text-faint">{u.email}{u.createdAt ? ` · joined ${new Date(u.createdAt).toLocaleDateString()}` : ""}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => act(u.uid, "approve")} disabled={busy === u.uid + "approve"}>
                      <Icon name="check" size={17} strokeWidth={2.25} /> {busy === u.uid + "approve" ? "…" : "Approve"}
                    </Button>
                    <button onClick={() => act(u.uid, "reject")} className="btn btn-ghost text-stop" disabled={busy === u.uid + "reject"}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="label mb-3">All accounts</h2>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-faint">
                  <th className="p-3">User</th><th className="p-3">Status</th><th className="p-3">Role</th><th className="p-3">Credits</th><th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {others.map((u) => {
                  const tone = u.status === "approved" ? "go" : u.status === "rejected" ? "stop" : "warn";
                  return (
                    <tr key={u.uid}>
                      <td className="p-3"><div className="font-medium">{u.name}</div><div className="text-xs text-faint">{u.email}</div></td>
                      <td className="p-3"><Badge tone={tone}>{u.status}</Badge></td>
                      <td className="p-3 capitalize text-muted">{u.role}</td>
                      <td className="num p-3">{u.credits}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => act(u.uid, "grant", 3)} className="btn btn-ghost px-2.5 py-1 text-xs">+3 credits</button>
                          {u.status !== "approved" ? (
                            <button onClick={() => act(u.uid, "approve")} className="btn btn-ghost px-2.5 py-1 text-xs text-go">Approve</button>
                          ) : u.role !== "admin" ? (
                            <button onClick={() => act(u.uid, "reject")} className="btn btn-ghost px-2.5 py-1 text-xs text-stop">Suspend</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </Container>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "go" | "warn" | "stop" }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={cn("num mt-1 text-2xl font-semibold", tone === "go" ? "text-go" : tone === "warn" ? "text-warn" : tone === "stop" ? "text-stop" : "")}>{value}</div>
    </div>
  );
}
