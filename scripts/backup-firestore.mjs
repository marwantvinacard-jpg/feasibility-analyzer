// Exports every collection to timestamped JSON files under backups/. Run
// manually, or schedule as a daily cron/Cloud Scheduler job — there's no
// managed backup for this project yet, so this is the disaster-recovery
// baseline until one is set up.
//   node scripts/backup-firestore.mjs
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url), "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// Top-level collections worth backing up. Subcollections (scenarios,
// members, apiKeys, stageOutputs) are nested under their parent doc's export.
const COLLECTIONS = ["users", "usernames", "analyses", "organizations", "payments", "auditLog", "trainingData"];
const SUBCOLLECTIONS = {
  analyses: ["scenarios"],
  organizations: ["members", "apiKeys"],
};

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = new URL(`../backups/${stamp}/`, import.meta.url);
mkdirSync(outDir, { recursive: true });

let totalDocs = 0;
for (const name of COLLECTIONS) {
  const snap = await db.collection(name).get();
  const docs = [];
  for (const doc of snap.docs) {
    const entry = { id: doc.id, data: doc.data() };
    for (const sub of SUBCOLLECTIONS[name] ?? []) {
      const subSnap = await doc.ref.collection(sub).get();
      if (!subSnap.empty) {
        entry[sub] = subSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
      }
    }
    docs.push(entry);
  }
  writeFileSync(new URL(`${name}.json`, outDir), JSON.stringify(docs, null, 2));
  console.log(`${name}: ${docs.length} docs`);
  totalDocs += docs.length;
}

console.log(`\nBackup complete: ${totalDocs} top-level docs written to backups/${stamp}/`);
console.log("Keep backups/ out of git (already gitignored) — copy it somewhere durable (S3, a separate drive) after each run.");
process.exit(0);
