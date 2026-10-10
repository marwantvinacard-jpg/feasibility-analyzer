// Server-side calls to Firebase Auth's REST API (Identity Toolkit), for the
// username login/reset routes: the server checks a password or sends a reset
// email for an address the browser is never told. Uses the project's public
// web API key; talks to the Auth emulator when FIREBASE_AUTH_EMULATOR_HOST is set.

function apiKey(): string {
  const key = process.env.FIREBASE_WEB_API_KEY ?? process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (key) return key;
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) return "emulator";
  throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY (or FIREBASE_WEB_API_KEY) is not set.");
}

function endpoint(method: string): string {
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const base = emulator ? `http://${emulator}/identitytoolkit.googleapis.com/v1` : "https://identitytoolkit.googleapis.com/v1";
  return `${base}/accounts:${method}?key=${encodeURIComponent(apiKey())}`;
}

async function call(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(endpoint(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  return { ok: false, error: data.error?.message ?? `HTTP ${res.status}` };
}

export type PasswordCheck = "ok" | "invalid" | "disabled";

/** Checks an email + password without creating a browser session. */
export async function checkPassword(email: string, password: string): Promise<PasswordCheck> {
  const r = await call("signInWithPassword", { email, password, returnSecureToken: false });
  if (r.ok) return "ok";
  if (r.error?.startsWith("USER_DISABLED")) return "disabled";
  if (/INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_EMAIL/.test(r.error ?? "")) return "invalid";
  throw new Error(`Auth service error: ${r.error}`);
}

/** Asks Firebase Auth to email a password-reset link. Unknown addresses are ignored silently. */
export async function sendPasswordResetEmailTo(email: string): Promise<void> {
  const r = await call("sendOobCode", { requestType: "PASSWORD_RESET", email });
  if (!r.ok && !/EMAIL_NOT_FOUND/.test(r.error ?? "")) throw new Error(`Auth service error: ${r.error}`);
}
