// How new accounts get approved. Server-only settings, shared by the admin
// approval route and the self-service activation route.

/** Free credits a newly approved account starts with (admin or automatic approval). */
export const APPROVAL_CREDITS = 3;

/**
 * "auto" (default): an account is approved automatically as soon as its email
 * is verified — Google sign-ins are verified from the start. Admins can still
 * reject anyone later.
 * "manual": the old flow — every signup waits for an admin to approve it.
 * Set SIGNUP_APPROVAL=manual in the environment to switch back.
 */
export function signupApprovalMode(): "auto" | "manual" {
  return process.env.SIGNUP_APPROVAL?.trim().toLowerCase() === "manual" ? "manual" : "auto";
}
