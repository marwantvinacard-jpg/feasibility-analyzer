// Plain-JS user seeder — avoids the tsx/esbuild issue on exFAT drives entirely
// by only importing firebase-admin (a real npm package) directly.
//   node scripts/seed-users.mjs
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url), "utf8"));
initializeApp({ credential: cert(sa) });
const auth = getAuth();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const ACCOUNTS = [
  { username: "marwan", password: "belhadj", name: "Marwan", role: "admin", credits: 999 },
  { username: "sophie", password: "sophiejelal", name: "Sophie", role: "user", credits: 10 },
  { username: "tarek", password: "tarekjelal", name: "Tarek", role: "user", credits: 10 },
];

async function upsert({ username, password, name, role, credits }) {
  const email = `${username}@feasibility.local`; // placeholder domain — never a real inbox
  let uid;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, { password, displayName: name });
    console.log(`~ updated  ${username}`);
  } catch {
    const created = await auth.createUser({ email, password, displayName: name });
    uid = created.uid;
    console.log(`+ created  ${username}`);
  }
  await auth.setCustomUserClaims(uid, { admin: role === "admin" });
  await db.collection("users").doc(uid).set(
    { email, name, status: "approved", role, credits, keyMode: "platform", username, updatedAt: new Date().toISOString() },
    { merge: true }
  );
  await db.collection("usernames").doc(username).set({ uid, email });
  return { username, uid, role };
}

const results = [];
for (const acc of ACCOUNTS) results.push(await upsert(acc));

console.log("\nAccounts ready — log in at /login with username + password:");
for (const r of results) console.log(`  ${r.username.padEnd(8)} (${r.role})`);
process.exit(0);
