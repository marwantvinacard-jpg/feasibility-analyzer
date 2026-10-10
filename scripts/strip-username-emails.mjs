// One-off migration for fix #33: usernames/{name} docs used to store the
// account's email and were publicly readable. New docs hold only { uid }; this
// removes the email from existing ones. Until it runs, the security rules keep
// those old docs unreadable from browsers. Safe to re-run.
//
//   CONFIRM_PROJECT=<firebase-project-id> node scripts/strip-username-emails.mjs
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { confirmProject } from "./_confirmProject.mjs";

const sa = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url), "utf8"));
confirmProject(sa);
initializeApp({ credential: cert(sa) });
const db = getFirestore();

let stripped = 0;
let batch = db.batch();
let inBatch = 0;
for (const doc of (await db.collection("usernames").get()).docs) {
  if (!("email" in doc.data())) continue;
  batch.update(doc.ref, { email: FieldValue.delete() });
  stripped++;
  if (++inBatch === 400) {
    await batch.commit();
    batch = db.batch();
    inBatch = 0;
  }
}
if (inBatch) await batch.commit();
console.log(`Removed the email from ${stripped} usernames doc(s).`);
process.exit(0);
