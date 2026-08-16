// Friendly messages for Firebase Auth error codes. Shared by the login + signup
// pages (page files can't export non-page helpers, hence its own module).
export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code.includes("email-already-in-use")) return "That email already has an account — try logging in.";
  if (code.includes("invalid-email")) return "That doesn't look like a valid email.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
    return "Wrong email or password.";
  if (code.includes("popup-closed")) return "Google sign-in was cancelled.";
  if (code.includes("network")) return "Network error — check your connection.";
  return (err as Error)?.message ?? "Something went wrong. Please try again.";
}
