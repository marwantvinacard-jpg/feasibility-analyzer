"use client";

import { useEffect, useState } from "react";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { fetchMyOrg, inviteMember, removeMember } from "@/lib/org";
import type { Organization, OrgMember, OrgRole } from "@/lib/orgTypes";

export default function TeamPage() {
  const { user } = useSession();
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const [identifier, setIdentifier] = useState("");
  const [role, setRole] = useState<OrgRole>("analyst");
  const [inviting, setInviting] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  async function load() {
    try {
      const data = await fetchMyOrg();
      setOrg(data.org);
      setMembers(data.members);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load team.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleInvite() {
    if (!identifier.trim()) return;
    setInviting(true);
    setError("");
    try {
      await inviteMember(identifier.trim(), role);
      setIdentifier("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that person.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(uid: string) {
    setBusyUid(uid);
    try {
      await removeMember(uid);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove member.");
    } finally {
      setBusyUid(null);
    }
  }

  if (!user || !loaded) return <div className="py-20 text-center text-sm text-muted">Loading…</div>;

  if (!org) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand"><Icon name="user" size={26} /></span>
        <h2 className="font-display mt-4 text-lg font-semibold">No organization yet</h2>
        <p className="mt-1 text-sm text-muted">Create one on the Organization page first, then invite your team here.</p>
        <Button href="/app/org" variant="ghost" className="mt-5">Go to Organization</Button>
      </div>
    );
  }

  const isOwner = org.ownerUid === user.uid;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1.5 text-sm text-muted">Everyone here sees every analysis run under {org.name}.</p>
      </div>

      {error && <p className="text-sm text-stop">{error}</p>}

      {isOwner && (
        <div className="card p-5">
          <div className="label mb-3">Add a teammate</div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <label className="mb-1.5 block text-xs text-faint">Username or email</label>
              <input className="input" placeholder="jane or jane@company.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-faint">Role</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
                <option value="analyst">Analyst</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <Button onClick={handleInvite} disabled={inviting || !identifier.trim()}>
              {inviting ? "Adding…" : "Add"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-faint">They must already have a FeasibilityAI account with no existing organization.</p>
        </div>
      )}

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.uid} className="card flex items-center justify-between p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 truncate font-medium">
                {m.name}
                {m.uid === org.ownerUid && <Badge tone="go">Owner</Badge>}
                {m.uid === user.uid && <span className="text-xs text-faint">(you)</span>}
              </div>
              <div className="truncate text-xs text-faint">{m.email} · {m.role}</div>
            </div>
            {isOwner && m.uid !== org.ownerUid && (
              <button
                onClick={() => handleRemove(m.uid)}
                disabled={busyUid === m.uid}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-faint hover:text-stop"
                aria-label={`Remove ${m.name}`}
              >
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
