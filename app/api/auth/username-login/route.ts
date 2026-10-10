// POST /api/auth/username-login — { username, password } -> { customToken }.
// Logging in with a username without ever sending that account's email to the
// browser: the server finds the email, checks the password with Firebase Auth,
// and returns a one-time custom token for signInWithCustomToken. Wrong password
// and unknown username get the same answer, and attempts are rate-limited per
// username and per address to stop password guessing.

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { logError } from "@/lib/firebase/errorLog";
import { checkPassword } from "@/lib/firebase/identityToolkit";
import { checkRateLimit } from "@/lib/rateLimit";
import { readJsonBody } from "@/lib/engine/validateInput";
import { accountForUsername, clientAddress } from "@/lib/usernameLookup";

export const runtime = "nodejs";

const WINDOW_MS = 15 * 60_000;
const WRONG = "Wrong username or password.";

export async function POST(req: Request) {
  const body = await readJsonBody(req, 2_000);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const { username, password } = (body.body ?? {}) as { username?: unknown; password?: unknown };
  if (typeof username !== "string" || typeof password !== "string" || !password || password.length > 200) {
    return NextResponse.json({ error: WRONG }, { status: 401 });
  }

  const user = username.trim().toLowerCase();
  const [perUser, perAddress] = await Promise.all([
    checkRateLimit(`login-user:${user}`, 10, WINDOW_MS),
    checkRateLimit(`login-ip:${clientAddress(req)}`, 30, WINDOW_MS),
  ]);
  if (!perUser.allowed || !perAddress.allowed) {
    return NextResponse.json({ error: "Too many sign-in attempts. Please wait a few minutes and try again." }, { status: 429 });
  }

  try {
    const account = await accountForUsername(user);
    if (!account) return NextResponse.json({ error: WRONG }, { status: 401 });
    const result = await checkPassword(account.email, password);
    if (result === "invalid") return NextResponse.json({ error: WRONG }, { status: 401 });
    if (result === "disabled") return NextResponse.json({ error: "This account has been disabled." }, { status: 403 });
    const customToken = await adminAuth().createCustomToken(account.uid);
    return NextResponse.json({ customToken });
  } catch (err) {
    await logError("auth.usernameLogin", err).catch(() => {});
    return NextResponse.json({ error: "Sign-in is unavailable right now. Please try again." }, { status: 503 });
  }
}
