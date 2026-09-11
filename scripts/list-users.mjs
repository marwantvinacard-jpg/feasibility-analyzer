// Plain-JS user lister — avoids the tsx/esbuild issue on exFAT drives.
//   node scripts/list-users.mjs
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const sa = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url), "utf8"));
initializeApp({ credential: cert(sa) });
const snap = await getFirestore().collection("users").get();
if (snap.empty) console.log("(no users yet)");
for (const d of snap.docs) {
  const u = d.data();
  console.log(`${(u.username ?? "?").padEnd(8)} role=${(u.role ?? "?").padEnd(6)} status=${(u.status ?? "?").padEnd(9)} credits=${u.credits} email=${u.email}`);
}
process.exit(0);
