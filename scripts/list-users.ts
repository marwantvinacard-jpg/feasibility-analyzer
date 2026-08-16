// Quick admin-side dump of the users collection. Run:
//   npx tsx scripts/list-users.ts
import { adminDb } from "../lib/firebase/admin";

async function main() {
  const snap = await adminDb().collection("users").get();
  if (snap.empty) return console.log("(no users yet)");
  for (const d of snap.docs) {
    const u = d.data();
    console.log(`- ${u.email}  [${u.status}/${u.role}]  credits=${u.credits}  uid=${d.id}`);
  }
}
main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
