"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  documentId,
  endAt,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  startAt,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { getFirebase } from "@/lib/firebase/client";
import { cn } from "@/lib/ui";
import { useT } from "@/lib/i18n/LanguageContext";
import { useToast } from "@/lib/toast";

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
interface OrgRow {
  id: string;
  name: string;
  ownerEmail: string;
  status: "pending" | "approved" | "rejected";
}
// The admin page used to live-subscribe to EVERY user and org, re-rendering all
// of them whenever anyone logged in (each visit writes lastSeenAt). Now only the
// short "needs action" lists are live; the full account list is paged.
const PAGE_SIZE = 50;
const PENDING_CAP = 100;

interface ErrorRow {
  id: string;
  context: string;
  message: string;
  createdAt: number;
}

export default function AdminPage() {
  const { ready, user, getIdToken } = useSession();
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [pending, setPending] = useState<UserRow[]>([]);
  const [accounts, setAccounts] = useState<UserRow[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [pendingOrgs, setPendingOrgs] = useState<OrgRow[]>([]);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (user.role !== "admin") router.replace("/app");
  }, [ready, user, router]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    const fb = getFirebase();
    if (!fb) return;
    const u1 = onSnapshot(
      query(collection(fb.db, "users"), where("status", "==", "pending"), limit(PENDING_CAP)),
      (snap) => setPending(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) })))
    );
    const u2 = onSnapshot(query(collection(fb.db, "auditLog"), orderBy("createdAt", "desc"), limit(50)), (snap) => {
      setAudit(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    const u3 = onSnapshot(
      query(collection(fb.db, "organizations"), where("status", "==", "pending"), limit(PENDING_CAP)),
      (snap) => setPendingOrgs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })))
    );
    const u4 = onSnapshot(query(collection(fb.db, "errorLog"), orderBy("createdAt", "desc"), limit(20)), (snap) => {
      setErrors(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    getCountFromServer(collection(fb.db, "users"))
      .then((c) => setTotalUsers(c.data().count))
      .catch(() => setTotalUsers(null));
    loadAccounts(true, "");
    return () => { u1(); u2(); u3(); u4(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /** One page of accounts. With a search term, pages through emails starting with it. */
  async function loadAccounts(reset: boolean, term: string) {
    const fb = getFirebase();
    if (!fb) return;
    setLoadingAccounts(true);
    try {
      const users = collection(fb.db, "users");
      const after = reset ? null : cursor;
      const q = term
        ? after
          ? query(users, orderBy("email"), startAfter(after), endAt(term + "\uf8ff"), limit(PAGE_SIZE))
          : query(users, orderBy("email"), startAt(term), endAt(term + "\uf8ff"), limit(PAGE_SIZE))
        : after
          ? query(users, orderBy(documentId()), startAfter(after), limit(PAGE_SIZE))
          : query(users, orderBy(documentId()), limit(PAGE_SIZE));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as any) }) as UserRow);
      setAccounts((prev) => (reset ? rows : [...prev, ...rows]));
      setCursor(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.size === PAGE_SIZE);
      setActiveSearch(term);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not load accounts.");
    } finally {
      setLoadingAccounts(false);
    }
  }

  /** The paged list isn't live — re-read just the row an action changed. */
  async function refreshRow(uid: string) {
    const fb = getFirebase();
    if (!fb) return;
    const snap = await getDoc(doc(fb.db, "users", uid)).catch(() => null);
    if (!snap?.exists()) return;
    const row = { uid, ...(snap.data() as any) } as UserRow;
    setAccounts((prev) => prev.map((r) => (r.uid === uid ? row : r)));
  }

  async function act(uid: string, action: "approve" | "reject" | "grant", amount?: number) {
    if (action === "reject" && !window.confirm(t("admin.confirmRejectUser"))) return;
    setBusy(uid + action);
    setActionError("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/admin/user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid, action, amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("admin.actionFailed"));
      toast.show(action === "grant" ? t("admin.creditsAdded") : action === "approve" ? t("admin.userApproved") : t("admin.userRejected"), "success");
      await refreshRow(uid);
    } catch (e) {
      const message = e instanceof Error ? e.message : t("admin.actionFailed");
      setActionError(message);
      toast.show(message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function actOrg(orgId: string, action: "approve" | "reject") {
    if (action === "reject" && !window.confirm(t("admin.confirmRejectOrg"))) return;
    setBusy(orgId + action);
    setActionError("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/admin/org", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ orgId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("admin.actionFailed"));
      toast.show(action === "approve" ? t("admin.orgApproved") : t("admin.orgRejected"), "success");
    } catch (e) {
      const message = e instanceof Error ? e.message : t("admin.actionFailed");
      setActionError(message);
      toast.show(message, "error");
    } finally {
      setBusy(null);
    }
  }

  if (!ready || !user || user.role !== "admin") return <div className="py-20 text-center text-sm text-muted">{t("common.loading")}</div>;


  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("admin.title")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("admin.subtitle")}</p>
      </div>

      {actionError && <p className="text-sm text-stop">{actionError}</p>}

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

      {pendingOrgs.length > 0 && (
        <section>
          <h2 className="label mb-3">{t("admin.pendingOrgsCount", { n: pendingOrgs.length })}</h2>
          <div className="space-y-2">
            {pendingOrgs.map((o) => (
              <div key={o.id} className="card flex items-center justify-between p-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{o.name}</div>
                  <div className="truncate text-xs text-faint">{o.ownerEmail}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" className="text-sm" disabled={busy === o.id + "reject"} onClick={() => actOrg(o.id, "reject")}>{t("admin.reject")}</Button>
                  <Button className="text-sm" disabled={busy === o.id + "approve"} onClick={() => actOrg(o.id, "approve")}>{t("admin.approve")}</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="label mb-3">{t("admin.allCount", { n: totalUsers ?? accounts.length })}</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); loadAccounts(true, search.trim()); }}
          className="mb-3 flex gap-2"
        >
          <input
            className="input flex-1"
            type="search"
            placeholder={t("admin.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" variant="ghost" disabled={loadingAccounts}>{t("admin.search")}</Button>
          {activeSearch && (
            <Button type="button" variant="ghost" onClick={() => { setSearch(""); loadAccounts(true, ""); }}>{t("admin.clearSearch")}</Button>
          )}
        </form>
        <div className="space-y-2">
          {accounts.length === 0 && !loadingAccounts && <p className="text-sm text-muted">{t("admin.noAccounts")}</p>}
          {accounts.map((u) => (
            <div key={u.uid} className="card flex items-center justify-between p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 truncate font-medium">
                  {u.name}
                  {u.role === "admin" && <Badge tone="go">{t("admin.adminBadge")}</Badge>}
                  <Badge tone={u.status === "approved" ? "go" : u.status === "pending" ? "warn" : "stop"}>{u.status}</Badge>
                </div>
                <div className="truncate text-xs text-faint">{u.email} · <span className="num">{u.credits}</span> {t("admin.creditsSuffix")}</div>
              </div>
              <Button variant="ghost" className="shrink-0 text-sm" disabled={busy === u.uid + "grant"} onClick={() => act(u.uid, "grant", 5)}>{t("admin.addCredits")}</Button>
            </div>
          ))}
        </div>
        {hasMore && (
          <div className="mt-3 text-center">
            <Button variant="ghost" onClick={() => loadAccounts(false, activeSearch)} disabled={loadingAccounts}>
              {loadingAccounts ? t("common.loading") : t("admin.loadMore")}
            </Button>
          </div>
        )}
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

      <section>
        <h2 className="label mb-3 flex items-center gap-2">
          {t("admin.serverErrors")}
          {errors.length > 0 && <Badge tone="stop">{errors.length}</Badge>}
        </h2>
        <div className="card divide-y divide-border/60 p-0">
          {errors.length === 0 && <p className="p-4 text-sm text-muted">{t("admin.noErrors")}</p>}
          {errors.map((e) => (
            <div key={e.id} className="px-4 py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-stop">{e.context}</span>
                <span className="text-xs text-faint">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted">{e.message}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
