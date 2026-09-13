"use client";

import { useState } from "react";
import { Badge, Button } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/ui";
import { useT } from "@/lib/i18n/LanguageContext";
import { useToast } from "@/lib/toast";

export default function SettingsPage() {
  const { user, setKeyMode, setTrainingOptOut } = useSession();
  const [trainingSaving, setTrainingSaving] = useState(false);
  const t = useT();
  const toast = useToast();
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);

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
          <div className="mt-4 rounded-xl border border-border bg-surface-2 p-4">
            <label className="mb-1.5 block text-sm font-medium">{t("settings.yourApiKey")}</label>
            <div className="flex gap-2">
              <input
                className="input font-mono"
                type="password"
                placeholder={t("settings.keyPlaceholder")}
                value={key}
                onChange={(e) => { setKey(e.target.value); setSaved(false); }}
              />
              <Button
                variant="ghost"
                onClick={() => { setSaved(true); toast.show(t("settings.keySaved"), "success"); }}
                disabled={key.length < 8}
              >
                {t("common.save")}
              </Button>
            </div>
            <p className="mt-2 text-xs text-faint">
              {saved ? (
                <span className="inline-flex items-center gap-1 text-go">
                  <Icon name="check" size={13} strokeWidth={2.5} /> {t("settings.keySaved")}
                </span>
              ) : (
                t("settings.keyStoredHint")
              )}
            </p>
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
