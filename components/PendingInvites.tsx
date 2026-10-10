"use client";

// Organization invites waiting for the signed-in user's answer. Joining an org
// shares every analysis you run with it, so it only ever happens from here —
// an owner can invite you, never add you.

import { useEffect, useState } from "react";
import { Button } from "@/components/kit";
import { Icon } from "@/components/icons";
import { fetchMyInvites, respondToInvite } from "@/lib/org";
import type { OrgInvite } from "@/lib/orgTypes";
import { useT } from "@/lib/i18n/LanguageContext";

export function PendingInvites({ onJoined }: { onJoined?: () => void }) {
  const t = useT();
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMyInvites()
      .then(({ invites }) => setInvites(invites))
      .catch(() => setInvites([]));
  }, []);

  async function respond(invite: OrgInvite, action: "accept" | "decline") {
    setBusy(invite.id);
    setError("");
    try {
      await respondToInvite(invite.orgId, action);
      if (action === "accept") {
        setInvites([]); // one org per user — the others can't be accepted now
        onJoined?.();
      } else {
        setInvites((p) => p.filter((i) => i.id !== invite.id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("invites.error"));
    } finally {
      setBusy(null);
    }
  }

  if (invites.length === 0) return null;

  return (
    <div className="space-y-2">
      {invites.map((inv) => (
        <div key={inv.id} className="card flex flex-wrap items-center justify-between gap-3 border-brand/30 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
              <Icon name="user" size={18} />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {t("invites.body", {
                  inviter: inv.invitedByEmail || t("invites.someone"),
                  org: inv.orgName,
                  role: t(inv.role === "viewer" ? "invites.roleViewer" : "invites.roleAnalyst"),
                })}
              </div>
              <div className="mt-0.5 text-xs text-muted">{t("invites.note")}</div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" onClick={() => respond(inv, "decline")} disabled={busy !== null}>
              {t("invites.decline")}
            </Button>
            <Button onClick={() => respond(inv, "accept")} disabled={busy !== null}>
              {busy === inv.id ? t("invites.joining") : t("invites.accept")}
            </Button>
          </div>
        </div>
      ))}
      {error && <p className="text-sm text-stop">{error}</p>}
    </div>
  );
}
