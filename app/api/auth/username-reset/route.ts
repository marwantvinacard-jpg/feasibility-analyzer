// POST /api/auth/username-reset — { username }. Sends a password-reset email
// for the account behind a username, without telling the browser the address
// (or whether the username exists: the answer is always the same).

import { NextResponse } from "next/server";
import { logError } from "@/lib/firebase/errorLog";
import { sendPasswordResetEmailTo } from "@/lib/firebase/identityToolkit";
import { checkRateLimit } from "@/lib/rateLimit";
import { readJsonBody } from "@/lib/engine/validateInput";
import { accountForUsername, clientAddress } from "@/lib/usernameLookup";

export const runtime = "nodejs";

const HOUR_MS = 60 * 60_000;

export async function POST(req: Request) {
  const body = await readJsonBody(req, 1_000);
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const username = String((body.body as { username?: unknown })?.username ?? "").trim().toLowerCase();

  const [perUser, perAddress] = await Promise.all([
    checkRateLimit(`reset-user:${username}`, 5, HOUR_MS),
    checkRateLimit(`reset-ip:${clientAddress(req)}`, 20, HOUR_MS),
  ]);
  if (!perUser.allowed || !perAddress.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  try {
    const account = await accountForUsername(username);
    if (account) await sendPasswordResetEmailTo(account.email);
  } catch (err) {
    await logError("auth.usernameReset", err).catch(() => {});
  }
  return NextResponse.json({ ok: true }); // same answer whether or not the username exists
}
