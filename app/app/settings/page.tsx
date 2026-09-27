"use client";

import { useEffect, useState } from "react";
import { Badge, Button } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/ui";
import { useT } from "@/lib/i18n/LanguageContext";
import { useToast } from "@/lib/toast";

export default function SettingsPage() {
  const { user, setKeyMode, setTrainingOptOut, getIdToken, logout } = useSession();
  const [trainingSaving, setTrainingSaving] = useState(false);
  const t = useT();
  const toast = useToast();
  const [key, setKey] = useState("");
  const [keyPreview, setKeyPreview] = useState<string | null>(null);
  const [keySaving, setKeySaving] = useState(false);
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function exportMyData() {
    setExporting(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/account?export=1", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Export failed.");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "feasibilityai-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Export failed.", "error");
    } finally {
      setExporting(false);
    }
  }

  async function deleteMyAccount() {
    if (!window.confirm("Permanently delete your account and every analysis you own? This cannot be undone.")) return;
    if (!window.confirm("Really sure? Type-to-confirm isn't required, but there is no undo after this.")) return;
    setDeleting(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/account", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not delete your account.");
      await logout();
      window.location.href = "/";
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Could not delete your account.", "error");
      setDeleting(false);
    }
  }

  async function openBillingPortal() {
    setPortalLoading(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/stripe/portal", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not open the billing portal.");
      window.location.href = data.url;
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Could not open the billing portal.", "error");
      setPortalLoading(false);
    }
  }

  useEffect(() => {
    if (!user || user.keyMode !== "byok" || keyLoaded) return;
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch("/api/settings/byok-key", { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setKeyPreview(data.preview ?? null);
      } finally {
        setKeyLoaded(true);
      }
    })();
  }, [user, keyLoaded, getIdToken]);

  async function saveKey() {
    if (key.trim().length < 8) return;
    setKeySaving(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/settings/byok-key", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key: key.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save the key.");
      setKeyPreview(data.preview ?? null);
      setKey("");
      toast.show(t("settings.keySaved"), "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : t("settings.keySaveFailed"), "error");
    } finally {
      setKeySaving(false);
    }
  }

  async function removeKey() {
    if (!window.confirm(t("settings.confirmRemoveKey"))) return;
    setKeySaving(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/settings/byok-key", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Could not remove the key.");
      setKeyPreview(null);
      toast.show(t("settings.keyRemoved"), "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : t("settings.keySaveFailed"), "error");
    } finally {
      setKeySaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="mt-1.5 text-sm text-muted">{t("settings.subtitle")}</p>
      </div>

      {/* Profile */}
      <section className="card p-5">
        <h2 className="label">{t("settings.profile")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t("settings.name")} value={user.name} />
          <Field label={t("settings.email")} value={user.email} plain />
          <Field label={t("settings.accountStatus")} value={user.status} />
          <Field label={t("settings.credits")} value={String(user.credits)} />
        </div>
      </section>

      {/* Billing */}
      {user.subscriptionStatus && (
        <section className="card p-5">
          <h2 className="label">{t("settings.billing")}</h2>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium capitalize">{user.subscriptionStatus}</div>
              <p className="mt-0.5 text-xs text-muted">{t("settings.billingHint")}</p>
            </div>
            <Button variant="ghost" onClick={openBillingPortal} disabled={portalLoading}>
              {portalLoading ? t("common.loading") : t("settings.manageBilling")}
            </Button>
          </div>
        </section>
      )}

      {/* AI key mode */}
      <section className="card p-5">
        <h2 className="label">{t("settings.aiEngine")}</h2>
        <p className="mt-1 text-sm text-muted">{t("settings.aiEngineHint")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ModeCard
            active={user.keyMode === "platform"}
            title={t("settings.platformKeyTitle")}
            desc={t("settings.platformKeyDesc")}
            onClick={() => setKeyMode("platform")}
          />
          <ModeCard
            active={user.keyMode === "byok"}
            title={t("settings.byokTitle")}
            desc={t("settings.byokDesc")}
            onClick={() => setKeyMode("byok")}
          />
        </div>

        {user.keyMode === "byok" && (
          <div className="mt-4 rounded-xl border border-border bg-surface-2 p-4">
            <label htmlFor="byok-key" className="mb-1.5 block text-sm font-medium">{t("settings.yourApiKey")}</label>
            {keyPreview ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-paper px-3 py-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-sm">
                  <Icon name="check" size={14} strokeWidth={2.5} className="text-go" /> {keyPreview}
                </span>
                <Button variant="ghost" onClick={removeKey} disabled={keySaving}>
                  {t("common.remove")}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  id="byok-key"
                  className="input font-mono"
                  type="password"
                  placeholder={t("settings.keyPlaceholder")}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                />
                <Button variant="ghost" onClick={saveKey} disabled={keySaving || key.trim().length < 8}>
                  {keySaving ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            )}
            <p className="mt-2 text-xs text-faint">{t("settings.keyStoredHint")}</p>
          </div>
        )}
      </section>

      {/* Model training opt-out */}
      <section className="card p-5">
        <h2 className="label">{t("settings.trainingTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("settings.trainingHint")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ModeCard
            active={!user.trainingOptOut}
            title={t("settings.trainingOn")}
            desc={t("settings.trainingOnDesc")}
            onClick={async () => {
              if (trainingSaving) return;
              setTrainingSaving(true);
              try {
                await setTrainingOptOut(false);
                toast.show(t("settings.trainingSaved"), "success");
              } catch {
                toast.show(t("settings.trainingSaveFailed"), "error");
              } finally {
                setTrainingSaving(false);
              }
            }}
          />
          <ModeCard
            active={!!user.trainingOptOut}
            title={t("settings.trainingOff")}
            desc={t("settings.trainingOffDesc")}
            onClick={async () => {
              if (trainingSaving) return;
              setTrainingSaving(true);
              try {
                await setTrainingOptOut(true);
                toast.show(t("settings.trainingSaved"), "success");
              } catch {
                toast.show(t("settings.trainingSaveFailed"), "error");
              } finally {
                setTrainingSaving(false);
              }
            }}
          />
        </div>
      </section>

      {/* Your data */}
      <section className="card border-stop/25 p-5">
        <h2 className="label text-stop">{t("settings.dangerZone")}</h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{t("settings.exportTitle")}</div>
            <p className="mt-0.5 text-xs text-muted">{t("settings.exportHint")}</p>
          </div>
          <Button variant="ghost" onClick={exportMyData} disabled={exporting}>
            {exporting ? t("common.loading") : t("settings.exportButton")}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div>
            <div className="text-sm font-medium text-stop">{t("settings.deleteTitle")}</div>
            <p className="mt-0.5 text-xs text-muted">{t("settings.deleteHint")}</p>
          </div>
          <Button
            variant="ghost"
            className="border-stop/40 text-stop hover:bg-stop/10"
            onClick={deleteMyAccount}
            disabled={deleting}
          >
            {deleting ? t("common.loading") : t("settings.deleteButton")}
          </Button>
        </div>
      </section>

      <p className="text-center text-xs text-faint">{t("settings.footerNote")}</p>
    </div>
  );
}

function Field({ label, value, plain }: { label: string; value: string; plain?: boolean }) {
  return (
    <div>
      <div className="text-xs text-faint">{label}</div>
      <div className={cn("mt-0.5 font-medium", !plain && "capitalize")}>{value}</div>
    </div>
  );
}

function ModeCard({ active, title, desc, onClick }: { active: boolean; title: string; desc: string; onClick: () => void }) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left transition",
        active ? "border-brand bg-brand/8 ring-1 ring-brand" : "border-border bg-surface-2 hover:border-brand/50"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold">{title}</span>
        {active && <Badge tone="go">{t("settings.active")}</Badge>}
      </div>
      <p className="mt-1 text-xs text-muted">{desc}</p>
    </button>
  );
}
