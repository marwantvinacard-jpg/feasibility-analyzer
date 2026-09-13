import type { Request, Response, NextFunction } from "express";
import { adminAuth, db, type UserProfile } from "../services/firebaseAdmin";

// Augment Express Request with the authenticated user context.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      uid?: string;
      userEmail?: string;
      profile?: UserProfile;
    }
  }
}

/** Verifies the Firebase ID token from the Authorization: Bearer header. */
export async function verifyAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer (.+)$/i);
    if (!match) {
      return res.status(401).json({ error: "Missing authentication token." });
    }
    const decoded = await adminAuth.verifyIdToken(match[1]);
    req.uid = decoded.uid;
    req.userEmail = decoded.email;
    next();
  } catch (e: any) {
    console.warn("Auth verification failed:", e?.message);
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

/** Loads the user's profile and attaches it. Requires verifyAuth first. */
async function loadProfile(req: Request): Promise<UserProfile | null> {
  if (!req.uid) return null;
  const snap = await db.collection("users").doc(req.uid).get();
  if (!snap.exists) return null;
  const profile = { uid: req.uid, ...(snap.data() as any) } as UserProfile;
  req.profile = profile;
  return profile;
}

/** Requires an approved (active) account. */
export async function requireActive(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const profile = await loadProfile(req);
  if (!profile) {
    return res
      .status(403)
      .json({ error: "No profile found.", code: "no_profile" });
  }
  if (profile.status === "disabled") {
    return res
      .status(403)
      .json({ error: "Your account has been disabled.", code: "disabled" });
  }
  if (profile.status !== "active") {
    return res.status(403).json({
      error: "Your account is awaiting admin approval.",
      code: "pending",
    });
  }
  next();
}

/** Requires an active admin account. */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const profile = req.profile || (await loadProfile(req));
  if (!profile || profile.role !== "admin" || profile.status !== "active") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}
