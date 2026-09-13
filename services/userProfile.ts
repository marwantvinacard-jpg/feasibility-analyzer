import {
  db,
  admin,
  SUPER_ADMIN_EMAIL,
  type UserProfile,
} from "./firebaseAdmin";

/**
 * Ensures a Firestore profile document exists for a freshly-authenticated user.
 * Idempotent: creates on first call, only touches lastLoginAt afterwards.
 *
 * New users default to status:"pending" / role:"user" and cannot self-promote —
 * the only fields a client can influence (displayName) are non-privileged, and
 * status/role are never accepted from the client.
 */
export async function ensureUserProfile(params: {
  uid: string;
  email: string;
  displayName?: string;
}): Promise<UserProfile> {
  const { uid, email } = params;
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const isSuperAdmin =
    SUPER_ADMIN_EMAIL !== "" && email.toLowerCase() === SUPER_ADMIN_EMAIL;

  if (!snap.exists) {
    const displayName =
      params.displayName?.trim() || email.split("@")[0] || "User";
    const profile = {
      email,
      displayName,
      status: isSuperAdmin ? "active" : "pending",
      role: isSuperAdmin ? "admin" : "user",
      hasApiKey: false,
      generationCount: 0,
      createdAt: now,
      lastLoginAt: now,
    };
    await ref.set(profile);
  } else {
    const update: Record<string, unknown> = { lastLoginAt: now };
    // Self-heal: guarantee the super-admin always has access, even if a stale
    // doc exists from before they were designated.
    if (isSuperAdmin) {
      const data = snap.data() || {};
      if (data.role !== "admin") update.role = "admin";
      if (data.status !== "active") update.status = "active";
    }
    await ref.update(update);
  }

  const fresh = await ref.get();
  return { uid, ...(fresh.data() as Omit<UserProfile, "uid">) };
}
