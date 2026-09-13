"use client";

import { useEffect, useState } from "react";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { fetchMyOrg, createOrg, updateOrgBranding } from "@/lib/org";
import type { Organization } from "@/lib/orgTypes";
import { OrgPlans, PLAN_LABEL } from "@/components/OrgPlans";

export default function OrgPage() {
  const { user } = useSession();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editName, setEditName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    try {
      const { org } = await fetchMyOrg();
      setOrg(org);
      if (org) {
        setEditName(org.name);
        setLogoUrl(org.branding.logoUrl ?? "");
        setPrimaryColor(org.branding.primaryColor ?? "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load organization.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      await createOrg(name.trim());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create organization.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await updateOrgBranding({ name: editName, logoUrl, primaryColor });
      setSaved(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (!user || !loaded) return <div className="py-20 text-center text-sm text-muted">Loading…</div>;

  const isOwner = org && org.ownerUid === user.uid;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Organization</h1>
        <p className="mt-1.5 text-sm text-muted">
          A shared workspace for your team — teammates see each other's analyses, and you get one branded, billable seat.
        </p>
      </div>

      {error && <p className="text-sm text-stop">{error}</p>}

      {!org ? (
        <div className="card space-y-4 p-6">
          <div>
            <h2 className="font-display text-lg font-semibold">Create your organization</h2>
            <p className="mt-1 text-sm text-muted">
              You'll become the owner — able to invite teammates, issue API keys, and set branding.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Organization name</label>
            <input className="input" placeholder="e.g. Meridian Feasibility Partners" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? "Creating…" : <>Create organization <Icon name="arrow" size={16} /></>}
          </Button>
        </div>
      ) : (
        <>
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="label">Organization</div>
                <div className="mt-1 font-display text-lg font-semibold">{org.name}</div>
              </div>
              <Badge tone={isOwner ? "go" : undefined}>{isOwner ? "You're the owner" : "Member"}</Badge>
            </div>
            <div className="mt-1 text-xs text-faint">Plan: {org.plan ? PLAN_LABEL[org.plan] : "No active plan"}</div>
          </div>

          {org.status === "pending" && (
            <div className="flex items-start gap-2.5 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
              <Icon name="clock" size={16} className="mt-0.5 shrink-0" />
              <span>
                <strong>Awaiting approval.</strong> An admin needs to approve {org.name} before you can issue API
                keys or subscribe to a plan. Team management still works in the meantime.
              </span>
            </div>
          )}
          {org.status === "rejected" && (
            <div className="flex items-start gap-2.5 rounded-xl border border-stop/40 bg-stop/10 px-4 py-3 text-sm text-stop">
              <Icon name="x" size={16} className="mt-0.5 shrink-0" />
              <span>This organization's access request was declined. Contact support if you think this is a mistake.</span>
            </div>
          )}

          {isOwner && org.status === "approved" && <OrgPlans currentPlan={org.plan} trialUsed={org.trialUsed} />}

          {isOwner && (
            <div className="card space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">Branding</h2>
              <p className="text-sm text-muted">
                Applied to reports and the shareable dashboard your clients see. Full custom-domain white-labeling
                needs a DNS step outside this app — ask when you're ready to set that up.
              </p>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Organization name</label>
                <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Logo URL</label>
                <input className="input" placeholder="https://…/logo.png" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Primary color</label>
                <div className="flex items-center gap-2">
                  <input
                    className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent"
                    type="color"
                    value={primaryColor || "#6366f1"}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                  />
                  <input className="input" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#6366f1" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save branding"}</Button>
                {saved && (
                  <span className="inline-flex items-center gap-1 text-sm text-go">
                    <Icon name="check" size={14} strokeWidth={2.5} /> Saved
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
