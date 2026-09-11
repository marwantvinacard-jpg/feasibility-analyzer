"use client";

import { useState } from "react";
import { Badge, Button } from "@/components/kit";
import { Icon } from "@/components/icons";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/ui";

export default function SettingsPage() {
  const { user, setKeyMode } = useSession();
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1.5 text-sm text-muted">Manage your profile, AI key, and usage.</p>
      </div>

      {/* Profile */}
      <section className="card p-5">
        <h2 className="label">Profile</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Name" value={user.name} />
          <Field label="Email" value={user.email} />
          <Field label="Account status" value={user.status} />
          <Field label="Credits" value={String(user.credits)} />
        </div>
      </section>

      {/* AI key mode */}
      <section className="card p-5">
        <h2 className="label">AI engine</h2>
        <p className="mt-1 text-sm text-muted">
          Run on our platform key (uses credits) or bring your own for higher limits at cost.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ModeCard
            active={user.keyMode === "platform"}
            title="Platform key"
            desc="Simplest. Each report uses one credit."
            onClick={() => setKeyMode("platform")}
          />
          <ModeCard
            active={user.keyMode === "byok"}
            title="Bring your own key"
            desc="Use your own AI key. No per-report credit."
            onClick={() => setKeyMode("byok")}
          />
        </div>

        {user.keyMode === "byok" && (
          <div className="mt-4 rounded-xl border border-border bg-surface-2 p-4">
            <label className="mb-1.5 block text-sm font-medium">Your API key</label>
            <div className="flex gap-2">
              <input
                className="input font-mono"
                type="password"
                placeholder="sk-… or a compatible key"
                value={key}
                onChange={(e) => { setKey(e.target.value); setSaved(false); }}
              />
              <Button variant="ghost" onClick={() => setSaved(true)} disabled={key.length < 8}>Save</Button>
            </div>
            <p className="mt-2 text-xs text-faint">
              {saved ? (
                <span className="inline-flex items-center gap-1 text-go">
                  <Icon name="check" size={13} strokeWidth={2.5} /> Key saved (concept — encrypted with Cloud KMS in production).
                </span>
              ) : (
                "Stored encrypted; never shown again. Works with OpenAI, Gemini, Groq, or a local Ollama endpoint."
              )}
            </p>
          </div>
        )}
      </section>

      <p className="text-center text-xs text-faint">
        Concept build · authentication & billing are wired at the Firebase step.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-faint">{label}</div>
      <div className="mt-0.5 font-medium capitalize">{value}</div>
    </div>
  );
}

function ModeCard({ active, title, desc, onClick }: { active: boolean; title: string; desc: string; onClick: () => void }) {
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
        {active && <Badge tone="go">Active</Badge>}
      </div>
      <p className="mt-1 text-xs text-muted">{desc}</p>
    </button>
  );
}
