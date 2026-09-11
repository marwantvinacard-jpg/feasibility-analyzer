"use client";

import { useEffect, useState } from "react";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { fetchMyOrg, createApiKey, revokeApiKey, subscribeApiKeys } from "@/lib/org";
import type { Organization, ApiKeyDoc } from "@/lib/orgTypes";

export default function ApiAccessPage() {
  const { user } = useSession();
  const [org, setOrg] = useState<Organization | null>(null);
  const [keys, setKeys] = useState<ApiKeyDoc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchMyOrg()
      .then((d) => setOrg(d.org))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."))
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
      const { key } = await createApiKey(label.trim() || "Untitled key");
      setFreshKey(key);
      setLabel("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create key.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setBusyId(id);
    try {
      await revokeApiKey(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke key.");
    } finally {
      setBusyId(null);
    }
  }

  if (!user || !loaded) return <div className="py-20 text-center text-sm text-muted">Loading…</div>;

  if (!org) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand"><Icon name="sliders" size={26} /></span>
        <h2 className="font-display mt-4 text-lg font-semibold">No organization yet</h2>
        <p className="mt-1 text-sm text-muted">API keys are issued per organization — create one first.</p>
        <Button href="/app/org" variant="ghost" className="mt-5">Go to Organization</Button>
      </div>
    );
  }

  const isOwner = org.ownerUid === user.uid;
  const activeKeys = keys.filter((k) => !k.revoked);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">API access</h1>
        <p className="mt-1.5 text-sm text-muted">
          Run feasibility analyses from your own systems instead of the web app. Each call costs one credit from
          the organization's balance, same as running it here.
        </p>
      </div>

      {error && <p className="text-sm text-stop">{error}</p>}

      {isOwner && (
        <div className="card p-5">
          <div className="label mb-3">Create a new key</div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <input className="input" placeholder='Label — e.g. "Production backend"' value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating…" : <>Create key <Icon name="plus" size={16} /></>}
            </Button>
          </div>
          {freshKey && (
            <div className="mt-4 rounded-xl border border-go/30 bg-go/8 p-4">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-go">
                <Icon name="check" size={14} strokeWidth={2.5} /> Copy this now — it won't be shown again
              </div>
              <code className="mt-2 block break-all rounded-lg bg-surface-2 p-3 text-xs">{freshKey}</code>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {activeKeys.length === 0 && !freshKey && (
          <div className="card py-10 text-center text-sm text-muted">No API keys yet.</div>
        )}
        {activeKeys.map((k) => (
          <div key={k.id} className="card flex items-center justify-between p-4">
            <div className="min-w-0">
              <div className="truncate font-medium">{k.label}</div>
              <div className="truncate text-xs text-faint">
                <code>{k.keyPrefix}…</code> · created by {k.createdBy}
                {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : " · never used"}
              </div>
            </div>
            {isOwner && (
              <button
                onClick={() => handleRevoke(k.id)}
                disabled={busyId === k.id}
                className="btn btn-ghost shrink-0 text-xs text-stop"
              >
                Revoke
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="label mb-3">Quick start</div>
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
        <p className="mt-3 text-xs text-faint">
          Synchronous — the response is the full feasibility result (all 8 dimensions plus the financial study, when
          applicable). A run typically takes under a minute. Same input shape as the web form's 10 core fields, plus
          the optional financial-study fields (currency, business_type, study_protocol, etc).
        </p>
      </div>
    </div>
  );
}
