// One-time bootstrap: creates (or resets) a single admin account you can log
// into immediately with a USERNAME, not an email — "admin" / a password you
// choose. This is meant to get you in the door on a fresh Firebase project.
//
//   npx tsx scripts/bootstrap-admin.ts admin ChangeMeImmediately123
//
// ⚠ SECURITY: this account can approve users, grant credits, and read every
// analysis. The moment you're in, either change its password (Firebase
// Console → Authentication → Users → ⋮ → Reset password) or promote your own
// real account with set-admin.ts and stop using this one. Never leave this
// running with a guessable password on anything real users touch.

import { adminAuth, adminDb } from "../lib/firebase/admin";

const INTERNAL_EMAIL = "admin@feasibility.local"; // placeholder domain — never a real inbox

async function main() {
  const username = (process.argv[2] || "admin").toLowerCase();
  const password = process.argv[3];
  if (!password || password.length < 4) {
    throw new Error("Usage: npx tsx scripts/bootstrap-admin.ts <username> <password>  (password >= 4 chars)");
  }
  if (password === "admin" || password === "password" || password === "1234") {
    console.warn(`⚠  "${password}" is a trivially guessable password. This is fine to test with LOCALLY,`);
    console.warn("   but change it before anyone else can reach this deployment.");
  }

  const auth = adminAuth();
  const db = adminDb();

  let uid: string;
  try {
    const existing = await auth.getUserByEmail(INTERNAL_EMAIL);
    uid = existing.uid;
    await auth.updateUser(uid, { password });
    console.log(`Existing bootstrap admin found (${uid}) — password reset.`);
  } catch {
    const created = await auth.createUser({ email: INTERNAL_EMAIL, password, displayName: "Admin" });
    uid = created.uid;
    console.log(`Created bootstrap admin (${uid}).`);
  }

  await auth.setCustomUserClaims(uid, { admin: true });
  await db.collection("users").doc(uid).set(
    {
      email: INTERNAL_EMAIL,
      name: "Admin",
      status: "approved",
      role: "admin",
      credits: 999,
      keyMode: "platform",
      username,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  await db.collection("usernames").doc(username).set({ uid, email: INTERNAL_EMAIL });

  console.log(`\n✓ Log in at /login with:`);
  console.log(`    Email or username: ${username}`);
  console.log(`    Password:          ${password}`);
  console.log(`\nChange this password immediately after your first login.`);
}

main().catch((e) => {
  console.error("bootstrap-admin failed:", e?.message ?? e);
  process.exit(1);
});
