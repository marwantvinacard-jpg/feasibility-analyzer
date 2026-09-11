"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { getFirebase } from "@/lib/firebase/client";
import { cn } from "@/lib/ui";
import { useT } from "@/lib/i18n/LanguageContext";

interface UserRow {
  uid: string;
  email: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  role: "user" | "admin";
  credits: number;
}
interface AuditRow {
  id: string;
  uid: string;
  email?: string;
  action: string;
  target?: string;
  createdAt: number;
}

export default function AdminPage() {
  const { ready, user, getIdToken } = useSession();
  const t = useT();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (user.role !== "admin") router.replace("/app");
  }, [ready, user, router]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    const fb = getFirebase();
    if (!fb) return;
    const u1 = onSnapshot(collection(fb.db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) })));
    });
    const u2 = onSnapshot(query(collection(fb.db, "auditLog"), orderBy("createdAt", "desc"), limit(50)), (snap) => {
      setAudit(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => { u1(); u2(); };
  }, [user]);

  async function act(uid: string, action: "approve" | "reject" | "grant", amount?: number) {
    setBusy(uid + action);
    try {
      const token = await getIdToken();
      await fetch("/api/admin/user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid, action, amount }),
      });
    } finally {
      setBusy(null);
    }
  }

  if (!ready || !user || user.role !== "admin") return <div className="py-20 text-center text-sm text-muted">{t("common.loading")}</div>;

  const pending = users.filter((u) => u.status === "pending");
  const others = users.filter((u) => u.status !== "pending");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("admin.title")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("admin.subtitle")}</p>
      </div>

      {pending.length > 0 && (
        <section>
          <h2 className="label mb-3">{t("admin.pendingCount", { n: pending.length })}</h2>
          <div className="space-y-2">
            {pending.map((u) => (
              <div key={u.uid} className="card flex items-center justify-between p-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{u.name}</div>
                  <div className="truncate text-xs text-faint">{u.email}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" className="text-sm" disabled={busy === u.uid + "reject"} onClick={() => act(u.uid, "reject")}>{t("admin.reject")}</Button>
                  <Button className="text-sm" disabled={busy === u.uid + "approve"} onClick={() => act(u.uid, "approve")}>{t("admin.approve")}</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="label mb-3">{t("admin.allCount", { n: others.length })}</h2>
        <div className="space-y-2">
          {others.map((u) => (
            <div key={u.uid} className="card flex items-center justify-between p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 truncate font-medium">
                  {u.name}
                  {u.role === "admin" && <Badge tone="go">{t("admin.adminBadge")}</Badge>}
                  <Badge tone={u.status === "approved" ? "go" : "stop"}>{u.status}</Badge>
                </div>
                <div className="truncate text-xs text-faint">{u.email} · <span className="num">{u.credits}</span> {t("admin.creditsSuffix")}</div>
              </div>
              <Button variant="ghost" className="shrink-0 text-sm" disabled={busy === u.uid + "grant"} onClick={() => act(u.uid, "grant", 5)}>{t("admin.addCredits")}</Button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="label mb-3">{t("admin.auditCount")}</h2>
        <div className="card divide-y divide-border/60 p-0">
          {audit.length === 0 && <p className="p-4 text-sm text-muted">{t("admin.nothingLogged")}</p>}
          {audit.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>
                <span className="font-medium">{a.action}</span>
                {a.target && <span className="text-faint"> · {a.target.slice(0, 12)}</span>}
              </span>
              <span className={cn("text-xs text-faint")}>{a.email ?? a.uid.slice(0, 8)} · {new Date(a.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
