"use client";

import { useEffect, useState } from "react";
import { Button, Badge } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { PendingInvites } from "@/components/PendingInvites";
import { cancelInvite, fetchMyOrg, inviteMember, removeMember } from "@/lib/org";
import type { Organization, OrgInvite, OrgMember, OrgRole } from "@/lib/orgTypes";

export default function TeamPage() {
  const { user } = useSession();
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [notice, setNotice] = useState("");
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
      setInvites(data.invites ?? []);
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
    setNotice("");
    try {
      const { invite } = await inviteMember(identifier.trim(), role);
      setIdentifier("");
      setNotice(`Invite sent to ${invite.email || invite.name}. They'll join once they accept it.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not invite that person.");
    } finally {
      setInviting(false);
    }
  }

  async function handleCancelInvite(uid: string) {
    setBusyUid(uid);
    try {
      await cancelInvite(uid);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel the invite.");
    } finally {
      setBusyUid(null);
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
        <div className="mt-8 text-start">
          <PendingInvites onJoined={load} />
        </div>
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
      {notice && <p className="text-sm text-go">{notice}</p>}

      {isOwner && (
        <div className="card p-5">
          <div className="label mb-3">Invite a teammate</div>
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
              {inviting ? "Inviting…" : "Invite"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-faint">They must already have a FeasibilityAI account with no existing organization. They get an invite to accept or decline, and nothing is shared until they accept.</p>
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

      {isOwner && invites.length > 0 && (
        <div className="space-y-2">
          <div className="label">Waiting for a reply</div>
          {invites.map((inv) => (
            <div key={inv.id} className="card flex items-center justify-between p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 truncate font-medium">
                  {inv.name}
                  <Badge tone="warn">Invited</Badge>
                </div>
                <div className="truncate text-xs text-faint">{inv.email} · {inv.role}</div>
              </div>
              <button
                onClick={() => handleCancelInvite(inv.uid)}
                disabled={busyUid === inv.uid}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-faint hover:text-stop"
                aria-label={`Cancel invite for ${inv.name}`}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
