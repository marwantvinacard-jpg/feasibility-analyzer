// Transactional email — server-only. Uses Resend's HTTP API directly (no SDK
// dependency needed for a handful of call sites). Silently no-ops without
// RESEND_API_KEY, same "degrade gracefully, never break the request that
// triggered it" pattern as the mock LLM/search providers: a missing key means
// no email goes out, not a thrown error that fails the approval or analysis.

const FROM = process.env.EMAIL_FROM || "FeasibilityAI <onboarding@resend.dev>";

async function send(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // not configured — deferred like SERPAPI_API_KEY/Stripe

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
  } catch {
    /* email is best-effort — never fails the action that triggered it */
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

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://feasibility-analyzer-eight.vercel.app";
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
