"use client";

import { useState } from "react";
import { Badge, Button } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/ui";
import { useT } from "@/lib/i18n/LanguageContext";
import { useToast } from "@/lib/toast";
import { deleteMyAccount, downloadMyData, removeByokKey, saveByokKey } from "@/lib/analyses";
import { BYOK_PROVIDER_LABELS, type ByokProvider } from "@/lib/byokProviders";

export default function SettingsPage() {
  const { user, setKeyMode, setTrainingOptOut, logout } = useSession();
  const [trainingSaving, setTrainingSaving] = useState(false);
  const t = useT();
  const toast = useToast();
  const [key, setKey] = useState("");
  const [provider, setProvider] = useState<ByokProvider>("openai");
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [dataBusy, setDataBusy] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [dataError, setDataError] = useState("");

  async function exportData() {
    setDataBusy(true);
    setDataError("");
    try {
      await downloadMyData();
    } catch (e) {
      setDataError(e instanceof Error ? e.message : t("settings.dataFailed"));
    } finally {
      setDataBusy(false);
    }
  }

  async function deleteAccount() {
    if (!window.confirm(t("settings.deleteConfirm"))) return;
    setDataBusy(true);
    setDataError("");
    try {
      await deleteMyAccount(deleteText.trim());
      await logout().catch(() => {});
      window.location.assign("/");
    } catch (e) {
      setDataError(e instanceof Error ? e.message : t("settings.dataFailed"));
      setDataBusy(false);
    }
  }

  // The key is sent once, checked with the provider and encrypted on the
  // server; the browser only ever gets back the provider and last 4 characters.
  async function saveKey() {
    setKeyBusy(true);
    setKeyError("");
    try {
      await saveByokKey(provider, key.trim());
      setKey("");
      toast.show(t("settings.keySaved"), "success");
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : t("settings.byokSaveFailed"));
    } finally {
      setKeyBusy(false);
    }
  }

  async function removeKey() {
    setKeyBusy(true);
    setKeyError("");
    try {
      await removeByokKey();
      toast.show(t("settings.byokRemoved"), "success");
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : t("settings.byokSaveFailed"));
    } finally {
      setKeyBusy(false);
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
          <div className="mt-4 space-y-3 rounded-xl border border-border bg-surface-2 p-4">
            {user.byokLast4 ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm text-go">
                  <Icon name="check" size={14} strokeWidth={2.5} />
                  {t("settings.byokSavedAs", {
                    provider: BYOK_PROVIDER_LABELS[user.byokProvider as ByokProvider] ?? user.byokProvider ?? "",
                    last4: user.byokLast4,
                  })}
                </span>
                <Button variant="ghost" className="text-sm" onClick={removeKey} disabled={keyBusy}>
                  {t("settings.byokRemove")}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-warn">{t("settings.byokNeedsKey")}</p>
            )}
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
              <select
                className="input"
                aria-label={t("settings.byokProvider")}
                value={provider}
                onChange={(e) => setProvider(e.target.value as ByokProvider)}
              >
                {(Object.keys(BYOK_PROVIDER_LABELS) as ByokProvider[]).map((p) => (
                  <option key={p} value={p}>{BYOK_PROVIDER_LABELS[p]}</option>
                ))}
              </select>
              <input
                className="input font-mono"
                type="password"
                autoComplete="off"
                aria-label={t("settings.yourApiKey")}
                placeholder={t("settings.keyPlaceholder")}
                value={key}
                onChange={(e) => { setKey(e.target.value); setKeyError(""); }}
              />
              <Button variant="ghost" onClick={saveKey} disabled={keyBusy || key.trim().length < 20}>
                {keyBusy ? t("settings.byokChecking") : user.byokLast4 ? t("settings.byokReplace") : t("common.save")}
              </Button>
            </div>
            <p className={cn("text-xs", keyError ? "text-stop" : "text-faint")}>{keyError || t("settings.keyStoredHint")}</p>
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

      {/* Your data: access + erasure (Privacy Policy → Your rights) */}
      <section className="card p-5">
        <h2 className="label">{t("settings.yourData")}</h2>
        <p className="mt-1 text-sm text-muted">{t("settings.yourDataHint")}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={exportData} disabled={dataBusy}>
            <Icon name="doc" size={15} /> {t("settings.downloadData")}
          </Button>
        </div>
        <div className="mt-5 rounded-xl border border-stop/30 bg-stop/5 p-4">
          <div className="text-sm font-semibold text-stop">{t("settings.deleteAccount")}</div>
          <p className="mt-1 text-xs text-muted">{t("settings.deleteAccountHint")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="input max-w-[12rem]"
              placeholder="DELETE"
              aria-label={t("settings.deleteTypeLabel")}
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
            />
            <Button onClick={deleteAccount} disabled={dataBusy || deleteText.trim() !== "DELETE"} className="bg-stop">
              {t("settings.deleteAccount")}
            </Button>
          </div>
        </div>
        {dataError && <p className="mt-3 text-sm text-stop">{dataError}</p>}
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
