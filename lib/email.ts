// Transactional email — server-only. Uses Resend's HTTP API directly (no SDK
// dependency needed for a handful of call sites). Silently no-ops without
// RESEND_API_KEY, same "degrade gracefully, never break the request that
// triggered it" pattern as the mock LLM/search providers: a missing key means
// no email goes out, not a thrown error that fails the approval or analysis.

import { logError } from "./firebase/errorLog";
import { isProductionDeployment } from "./runtimeEnv";

/** Resend's shared test sender. It only delivers to the Resend account owner's own address. */
const TEST_SENDER = "FeasibilityAI <onboarding@resend.dev>";

const isProduction = isProductionDeployment;

// Log each setup problem once per server instance, not once per email.
const reportedConfigProblems = new Set<string>();
async function reportConfigProblem(problem: string) {
  if (reportedConfigProblems.has(problem)) return;
  reportedConfigProblems.add(problem);
  await logError("email.config", new Error(problem));
}

/**
 * The sender to use, or null when production email isn't set up properly. In
 * production, silently falling back to the test sender meant approval, invite
 * and "report ready" emails looked sent but never reached anyone.
 */
export function emailSender(): string | null {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  return isProduction() ? null : TEST_SENDER;
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Fine in dev/staging; in production it means no user ever gets an email.
    if (isProduction()) await reportConfigProblem("RESEND_API_KEY is not set: no transactional emails are being sent.");
    return;
  }
  const from = emailSender();
  if (!from) {
    await reportConfigProblem(
      "EMAIL_FROM is not set: production emails would go from Resend's test sender, which only delivers to the Resend account owner. Set EMAIL_FROM to an address on a domain verified in Resend."
    );
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      // Previously swallowed silently — a bad key, an unverified sending
      // domain, or a rate limit all looked identical to "email is working."
      const body = await res.text().catch(() => "");
      await logError("email.send", new Error(`Resend ${res.status}: ${body.slice(0, 500)}`), { to, subject });
    }
  } catch (err) {
    // Still best-effort — never fails the action that triggered it — but now
    // at least visible in errorLog/Sentry instead of vanishing.
    await logError("email.send", err, { to, subject });
  }
}

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F4F1EA;font-family:-apple-system,Segoe UI,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
      <div style="font-weight:700;font-size:18px;color:#1A1A1A;margin-bottom:24px;">FeasibilityAI</div>
      <div style="background:#fff;border:1px solid #E4E0D6;border-radius:16px;padding:28px;">
        <h1 style="font-size:20px;margin:0 0 12px;color:#1A1A1A;">${title}</h1>
        ${bodyHtml}
      </div>
      <p style="margin-top:20px;font-size:12px;color:#8A8478;">You're receiving this because you have an account on FeasibilityAI.</p>
    </div>
  </body></html>`;
}

export async function sendApprovalEmail(to: string, name: string): Promise<void> {
  await send(
    to,
    "Your FeasibilityAI account is approved",
    layout(
      "You're in.",
      `<p style="color:#4A453D;font-size:14px;line-height:1.6;">Hi ${escapeHtml(name)}, your account has been approved and your free credits are ready. Head back in and run your first feasibility analysis.</p>
       <a href="${appUrl()}/login" style="display:inline-block;margin-top:16px;background:#6C5CE7;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Log in</a>`
    )
  );
}

export async function sendRejectionEmail(to: string, name: string): Promise<void> {
  await send(
    to,
    "Your FeasibilityAI account request",
    layout(
      "Access request declined",
      `<p style="color:#4A453D;font-size:14px;line-height:1.6;">Hi ${escapeHtml(name)}, we're not able to approve your account at this time. Reply to this email if you think this was a mistake.</p>`
    )
  );
}

export async function sendAnalysisReadyEmail(to: string, name: string, analysisId: string, businessIdea: string): Promise<void> {
  await send(
    to,
    `Your report is ready: ${truncate(businessIdea, 60)}`,
    layout(
      "Your feasibility report is ready.",
      `<p style="color:#4A453D;font-size:14px;line-height:1.6;">Hi ${escapeHtml(name)}, the analysis for "<strong>${escapeHtml(truncate(businessIdea, 80))}</strong>" has finished. View the full breakdown — score, financials, risks, and recommendation.</p>
       <a href="${appUrl()}/app/analysis/${analysisId}" style="display:inline-block;margin-top:16px;background:#6C5CE7;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">View report</a>`
    )
  );
}

export async function sendOrgInviteEmail(to: string, name: string, orgName: string, invitedBy: string): Promise<void> {
  await send(
    to,
    `You've been invited to join ${truncate(orgName, 60)} on FeasibilityAI`,
    layout(
      "You have an organization invite.",
      `<p style="color:#4A453D;font-size:14px;line-height:1.6;">Hi ${escapeHtml(name)}, ${escapeHtml(invitedBy || "an organization owner")} invited you to join <strong>${escapeHtml(orgName)}</strong>. If you join, everyone in that organization can see the analyses you run. Nothing is shared unless you accept.</p>
       <a href="${appUrl()}/app" style="display:inline-block;margin-top:16px;background:#6C5CE7;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;">Review invite</a>`
    )
  );
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://feasibility-analyzer-eight.vercel.app";
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
