"use client";

import { useEffect, useState } from "react";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { fetchMyOrg, createApiKey, revokeApiKey, subscribeApiKeys } from "@/lib/org";
import type { Organization, ApiKeyDoc } from "@/lib/orgTypes";
import { useT } from "@/lib/i18n/LanguageContext";

export default function ApiAccessPage() {
  const { user } = useSession();
  const t = useT();
  const [org, setOrg] = useState<Organization | null>(null);
  const [keys, setKeys] = useState<ApiKeyDoc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchMyOrg()
      .then((d) => setOrg(d.org))
      .catch((e) => setError(e instanceof Error ? e.message : t("apiAccess.loadFailed")))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!org) return;
    const unsub = subscribeApiKeys(org.id, setKeys);
    return () => unsub();
  }, [org]);

  async function handleCreate() {
    setCreating(true);
    setError("");
    setFreshKey(null);
    try {
      const days = expiresInDays ? Number(expiresInDays) : undefined;
      const { key } = await createApiKey(label.trim() || t("apiAccess.untitledKey"), days);
      setFreshKey(key);
      setLabel("");
      setExpiresInDays("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("apiAccess.createFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm(t("apiAccess.confirmRevoke"))) return;
    setBusyId(id);
    try {
      await revokeApiKey(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("apiAccess.revokeFailed"));
    } finally {
      setBusyId(null);
    }
  }

  if (!user || !loaded) return <div className="py-20 text-center text-sm text-muted">{t("common.loading")}</div>;

  if (!org) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand"><Icon name="sliders" size={26} /></span>
        <h2 className="font-display mt-4 text-lg font-semibold">{t("apiAccess.noOrgTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("apiAccess.noOrgBody")}</p>
        <Button href="/app/org" variant="ghost" className="mt-5">{t("apiAccess.goToOrg")}</Button>
      </div>
    );
  }

  if (org.status !== "approved") {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-warn/12 text-warn"><Icon name="clock" size={26} /></span>
        <h2 className="font-display mt-4 text-lg font-semibold">
          {org.status === "rejected" ? t("apiAccess.declinedTitle") : t("apiAccess.pendingTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {org.status === "rejected" ? t("apiAccess.declinedBody") : t("apiAccess.pendingBody")}
        </p>
      </div>
    );
  }

  const isOwner = org.ownerUid === user.uid;
  const activeKeys = keys.filter((k) => !k.revoked);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("apiAccess.title")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("apiAccess.subtitle")}</p>
      </div>

      {error && <p className="text-sm text-stop">{error}</p>}

      {isOwner && (
        <div className="card p-5">
          <div className="label mb-3">{t("apiAccess.createNew")}</div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <label htmlFor="key-label" className="sr-only">{t("apiAccess.keyLabelField")}</label>
              <input id="key-label" className="input" placeholder={t("apiAccess.keyLabelPlaceholder")} value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div>
              <label htmlFor="key-expiry" className="sr-only">{t("apiAccess.expiryField")}</label>
              <select id="key-expiry" className="input" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)}>
                <option value="">{t("apiAccess.neverExpires")}</option>
                <option value="30">{t("apiAccess.expires30")}</option>
                <option value="90">{t("apiAccess.expires90")}</option>
                <option value="365">{t("apiAccess.expires365")}</option>
              </select>
            </div>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? t("apiAccess.creating") : <>{t("apiAccess.createKey")} <Icon name="plus" size={16} /></>}
            </Button>
          </div>
          {freshKey && (
            <div className="mt-4 rounded-xl border border-go/30 bg-go/8 p-4">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-go">
                <Icon name="check" size={14} strokeWidth={2.5} /> {t("apiAccess.copyNow")}
              </div>
              <code className="mt-2 block break-all rounded-lg bg-surface-2 p-3 text-xs">{freshKey}</code>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {activeKeys.length === 0 && !freshKey && (
          <div className="card py-10 text-center text-sm text-muted">{t("apiAccess.noKeys")}</div>
        )}
        {activeKeys.map((k) => (
          <div key={k.id} className="card flex items-center justify-between p-4">
            <div className="min-w-0">
              <div className="truncate font-medium">{k.label}</div>
              <div className="truncate text-xs text-faint">
                <code>{k.keyPrefix}…</code> · {t("apiAccess.createdBy", { by: k.createdBy })}
                {k.lastUsedAt ? ` · ${t("apiAccess.lastUsed", { date: new Date(k.lastUsedAt).toLocaleDateString() })}` : ` · ${t("apiAccess.neverUsed")}`}
                {k.expiresAt && ` · ${k.expiresAt < Date.now() ? t("apiAccess.expired") : t("apiAccess.expiresOn", { date: new Date(k.expiresAt).toLocaleDateString() })}`}
              </div>
            </div>
            {isOwner && (
              <button
                onClick={() => handleRevoke(k.id)}
                disabled={busyId === k.id}
                className="btn btn-ghost shrink-0 text-xs text-stop"
              >
                {t("apiAccess.revoke")}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="label mb-3">{t("apiAccess.quickStart")}</div>
        <pre className="overflow-x-auto rounded-lg bg-surface-2 p-4 text-xs leading-relaxed">
{`curl -X POST https://your-deployment.example.com/api/v1/analyze \\
  -H "Authorization: Bearer fsa_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "input": {
      "business_idea": "A subscription meal-prep service...",
      "target_customer": "...",
      "location": "Austin, USA",
      "problem_solved": "...",
      "product_service": "...",
      "revenue_model": "...",
      "competitors": "...",
      "monthly_cost": 42000,
      "monthly_revenue": 68000,
      "unique_advantage": "...",
      "currency": "USD"
    }
  }'`}
        </pre>
        <p className="mt-3 text-xs text-faint">{t("apiAccess.quickStartHint")}</p>
      </div>
    </div>
  );
}
