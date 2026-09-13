const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

// Fail closed: if SUPER_ADMIN_EMAIL is unset, no one is auto-provisioned as
// admin. Set it in the Functions environment at deploy time.
const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || "")
  .trim()
  .toLowerCase();

/**
 * Auth onCreate trigger — provisions a Firestore profile for every new signup.
 * New users are "pending" until an admin approves them. The designated
 * super-admin email is provisioned as an active admin automatically.
 */
exports.provisionUser = functions.auth.user().onCreate(async (user) => {
  const email = (user.email || "").toLowerCase();
  const isSuperAdmin = SUPER_ADMIN_EMAIL !== "" && email === SUPER_ADMIN_EMAIL;

  const profile = {
    email: user.email || "",
    displayName: user.displayName || (user.email || "user").split("@")[0],
    status: isSuperAdmin ? "active" : "pending",
    role: isSuperAdmin ? "admin" : "user",
    hasApiKey: false,
    generationCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await admin
    .firestore()
    .collection("users")
    .doc(user.uid)
    .set(profile, { merge: true });
});
