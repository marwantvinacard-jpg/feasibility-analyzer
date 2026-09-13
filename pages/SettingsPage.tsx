import React, { useEffect, useState } from "react";
import { Key, ShieldCheck, Trash2, Loader2, ExternalLink, Sparkles } from "lucide-react";
import {
  getApiKeyStatus,
  saveApiKey,
  deleteApiKey,
  getMagnificKeyStatus,
  saveMagnificKey,
  deleteMagnificKey,
} from "../services/api";
import { useAuth } from "../context/AuthContext";

export const SettingsPage: React.FC = () => {
  const { profile } = useAuth();
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const [hasMagnificKey, setHasMagnificKey] = useState<boolean>(false);
  const [magnificKeyInput, setMagnificKeyInput] = useState("");
  const [magnificLoading, setMagnificLoading] = useState(true);
  const [magnificSaving, setMagnificSaving] = useState(false);
  const [magnificMessage, setMagnificMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const refresh = () =>
    getApiKeyStatus()
      .then(setHasApiKey)
      .catch(() => setHasApiKey(false))
      .finally(() => setLoading(false));

  const refreshMagnific = () =>
    getMagnificKeyStatus()
      .then(setHasMagnificKey)
      .catch(() => setHasMagnificKey(false))
      .finally(() => setMagnificLoading(false));

  useEffect(() => {
    refresh();
    refreshMagnific();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      await saveApiKey(keyInput.trim());
      setKeyInput("");
      setHasApiKey(true);
      setMessage({ type: "ok", text: "API key saved securely." });
    } catch (err: any) {
      setMessage({ type: "err", text: err?.message || "Failed to save key." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Remove your saved API key? You won't be able to generate until you add a new one.")) return;
    setSaving(true);
    setMessage(null);
    try {
      await deleteApiKey();
      setHasApiKey(false);
      setMessage({ type: "ok", text: "API key removed." });
    } catch (err: any) {
      setMessage({ type: "err", text: err?.message || "Failed to remove key." });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMagnific = async (e: React.FormEvent) => {
    e.preventDefault();
    setMagnificMessage(null);
    setMagnificSaving(true);
    try {
      await saveMagnificKey(magnificKeyInput.trim());
      setMagnificKeyInput("");
      setHasMagnificKey(true);
      setMagnificMessage({ type: "ok", text: "Magnific API key saved securely." });
    } catch (err: any) {
      setMagnificMessage({ type: "err", text: err?.message || "Failed to save key." });
    } finally {
      setMagnificSaving(false);
    }
  };

  const handleDeleteMagnific = async () => {
    if (!confirm("Remove your saved Magnific API key? You won't be able to enhance renders until you add a new one.")) return;
    setMagnificSaving(true);
    setMagnificMessage(null);
    try {
      await deleteMagnificKey();
      setHasMagnificKey(false);
      setMagnificMessage({ type: "ok", text: "Magnific API key removed." });
    } catch (err: any) {
      setMagnificMessage({ type: "err", text: err?.message || "Failed to remove key." });
    } finally {
      setMagnificSaving(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-serif text-4xl text-charcoal mb-2">Settings</h1>
      <p className="text-gray-500 mb-10">
        Manage your account and your personal Gemini API key.
      </p>

      {/* Account card */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
        <h2 className="font-bold text-lg mb-4">Account</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-400">Name</dt>
            <dd className="font-semibold">{profile?.displayName}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Email</dt>
            <dd className="font-semibold">{profile?.email}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Status</dt>
            <dd className="font-semibold capitalize">{profile?.status}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Role</dt>
            <dd className="font-semibold capitalize">{profile?.role}</dd>
          </div>
        </dl>
      </section>

      {/* API key card */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Key size={20} className="text-gold-600" />
          <h2 className="font-bold text-lg">Gemini API Key</h2>
        </div>
        <p className="text-gray-500 text-sm mb-5">
          Your key is encrypted at rest and only used to run your own
          generations. It is never shown again after saving.
        </p>

        {loading ? (
          <Loader2 className="animate-spin text-gray-400" />
        ) : (
          <>
            {hasApiKey ? (
              <div className="flex items-center justify-between gap-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-5">
                <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                  <ShieldCheck size={18} /> A key is saved and active
                </div>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-red-600 text-sm font-semibold hover:text-red-700 disabled:opacity-50"
                >
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 text-amber-800 text-sm">
                No API key on file yet. Add one below to start generating.
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <label htmlFor="gemini-api-key" className="sr-only">
                Gemini API key
              </label>
              <input
                id="gemini-api-key"
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={hasApiKey ? "Enter a new key to replace" : "AIza..."}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent font-mono"
              />
              <div className="flex items-center justify-between gap-4">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-gold-600 font-semibold"
                >
                  Get a Gemini API key <ExternalLink size={14} />
                </a>
                <button
                  type="submit"
                  disabled={saving || keyInput.trim().length < 10}
                  className="bg-charcoal text-white font-bold px-6 py-3 rounded-lg hover:bg-black disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="animate-spin" size={16} />}
                  {hasApiKey ? "Replace key" : "Save key"}
                </button>
              </div>
            </form>

            {message && (
              <p
                className={`mt-4 text-sm ${
                  message.type === "ok" ? "text-green-700" : "text-red-600"
                }`}
              >
                {message.text}
              </p>
            )}
          </>
        )}
      </section>

      {/* Magnific enhancement key card */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 mt-8">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={20} className="text-gold-600" />
          <h2 className="font-bold text-lg">Magnific Enhancement Key</h2>
        </div>
        <p className="text-gray-500 text-sm mb-5">
          Optional. Add your own Magnific API key to upscale and enhance any
          generated render straight from Studio or Pro Studio. Encrypted at
          rest, same as your Gemini key.
        </p>

        {magnificLoading ? (
          <Loader2 className="animate-spin text-gray-400" />
        ) : (
          <>
            {hasMagnificKey ? (
              <div className="flex items-center justify-between gap-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-5">
                <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                  <ShieldCheck size={18} /> A key is saved and active
                </div>
                <button
                  onClick={handleDeleteMagnific}
                  disabled={magnificSaving}
                  className="flex items-center gap-1.5 text-red-600 text-sm font-semibold hover:text-red-700 disabled:opacity-50"
                >
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 text-amber-800 text-sm">
                No Magnific key on file. Enhancement is disabled until you add one.
              </div>
            )}

            <form onSubmit={handleSaveMagnific} className="space-y-4">
              <label htmlFor="magnific-api-key" className="sr-only">
                Magnific API key
              </label>
              <input
                id="magnific-api-key"
                type="password"
                value={magnificKeyInput}
                onChange={(e) => setMagnificKeyInput(e.target.value)}
                placeholder={hasMagnificKey ? "Enter a new key to replace" : "mgnf_..."}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent font-mono"
              />
              <div className="flex items-center justify-between gap-4">
                <a
                  href="https://magnific.com/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-gold-600 font-semibold"
                >
                  Get a Magnific API key <ExternalLink size={14} />
                </a>
                <button
                  type="submit"
                  disabled={magnificSaving || magnificKeyInput.trim().length < 10}
                  className="bg-charcoal text-white font-bold px-6 py-3 rounded-lg hover:bg-black disabled:opacity-50 flex items-center gap-2"
                >
                  {magnificSaving && <Loader2 className="animate-spin" size={16} />}
                  {hasMagnificKey ? "Replace key" : "Save key"}
                </button>
              </div>
            </form>

            {magnificMessage && (
              <p
                className={`mt-4 text-sm ${
                  magnificMessage.type === "ok" ? "text-green-700" : "text-red-600"
                }`}
              >
                {magnificMessage.text}
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
};
