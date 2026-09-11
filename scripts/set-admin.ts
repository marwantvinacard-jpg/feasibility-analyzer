// Promote an existing account to admin (approved + role admin + credits + the
// `admin` custom claim used by the security rules). The person must have signed
// up in the app first (so the Auth user exists). Run:
//   npx tsx scripts/set-admin.ts you@example.com

import { adminAuth, adminDb } from "../lib/firebase/admin";

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: npx tsx scripts/set-admin.ts <email>");

  const user = await adminAuth().getUserByEmail(email);
  await adminAuth().setCustomUserClaims(user.uid, { admin: true });

  await adminDb()
    .collection("users")
    .doc(user.uid)
    .set(
      {
        email,
        name: user.displayName ?? email.split("@")[0],
        status: "approved",
        role: "admin",
        credits: 999,
        keyMode: "platform",
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

  console.log(`✓ ${email} (${user.uid}) is now an approved admin.`);
  console.log("  They must sign out and back in for the admin claim to take effect.");
}

main().catch((e) => {
  console.error("set-admin failed:", e?.message ?? e);
  process.exit(1);
});
