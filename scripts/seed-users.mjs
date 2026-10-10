// Plain-JS user seeder — avoids the tsx/esbuild issue on exFAT drives entirely
// by only importing firebase-admin (a real npm package) directly.
//
//   node scripts/seed-users.mjs --project=<firebase-project-id> [--reset-passwords]
//
// SECURITY: this file must never contain a password. It used to, in a public
// repo — anyone could log in as the admin account. Now:
//   - each password comes from SEED_PASSWORD_<USERNAME> (e.g. SEED_PASSWORD_MARWAN,
//     at least 12 characters) or is generated randomly and printed ONCE;
//   - an existing account's password is only changed with --reset-passwords
//     (which is also how to rotate them);
//   - --project must match the service account's project, so this can't be run
//     against production by accident.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const projectArg = args.find((a) => a.startsWith("--project="))?.slice("--project=".length);
const resetPasswords = args.includes("--reset-passwords");

const sa = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url), "utf8"));
if (!projectArg || projectArg !== sa.project_id) {
  console.error(
    `Refusing to run: pass --project=${sa.project_id ?? "<id>"} to confirm the target.\n` +
      `serviceAccountKey.json points at project "${sa.project_id}".`
  );
  process.exit(1);
}
console.log(`Target project: ${sa.project_id}${resetPasswords ? "  (resetting passwords)" : ""}`);

initializeApp({ credential: cert(sa) });
const auth = getAuth();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const ACCOUNTS = [
  { username: "marwan", name: "Marwan", role: "admin", credits: 999 },
  { username: "sophie", name: "Sophie", role: "user", credits: 10 },
  { username: "tarek", name: "Tarek", role: "user", credits: 10 },
];

/** From SEED_PASSWORD_<USERNAME>, else a random 24-character password. */
function passwordFor(username) {
  const fromEnv = process.env[`SEED_PASSWORD_${username.toUpperCase()}`];
  if (fromEnv) {
    if (fromEnv.length < 12) throw new Error(`SEED_PASSWORD_${username.toUpperCase()} must be at least 12 characters.`);
    return { password: fromEnv, generated: false };
  }
  return { password: randomBytes(18).toString("base64url"), generated: true };
}

async function upsert({ username, name, role, credits }) {
  const email = `${username}@feasibility.local`; // placeholder domain — never a real inbox
  let uid;
  let newPassword = null;
  const existing = await auth.getUserByEmail(email).catch(() => null);
  if (existing) {
    uid = existing.uid;
    if (resetPasswords) {
      const p = passwordFor(username);
      await auth.updateUser(uid, { password: p.password, displayName: name });
      newPassword = p;
      console.log(`~ updated  ${username} (password reset)`);
    } else {
      await auth.updateUser(uid, { displayName: name });
      console.log(`~ updated  ${username} (password unchanged)`);
    }
  } else {
    const p = passwordFor(username);
    const created = await auth.createUser({ email, password: p.password, displayName: name });
    uid = created.uid;
    newPassword = p;
    console.log(`+ created  ${username}`);
  }
  await auth.setCustomUserClaims(uid, { admin: role === "admin" });
  await db.collection("users").doc(uid).set(
    { email, name, status: "approved", role, credits, keyMode: "platform", username, updatedAt: new Date().toISOString() },
    { merge: true }
  );
  await db.collection("usernames").doc(username).set({ uid }); // uid only — emails are never stored here
  return { username, uid, role, newPassword };
}

const results = [];
for (const acc of ACCOUNTS) results.push(await upsert(acc));

console.log("\nAccounts ready — log in at /login with username + password:");
for (const r of results) {
  const pw = !r.newPassword
    ? "(unchanged)"
    : r.newPassword.generated
      ? r.newPassword.password
      : "(from SEED_PASSWORD_" + r.username.toUpperCase() + ")";
  console.log(`  ${r.username.padEnd(8)} (${r.role.padEnd(5)})  ${pw}`);
}
if (results.some((r) => r.newPassword?.generated)) {
  console.log("\nGenerated passwords are shown ONCE — store them in a password manager now.");
}
process.exit(0);
