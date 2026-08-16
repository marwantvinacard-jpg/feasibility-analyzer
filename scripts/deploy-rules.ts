// Deploy Firestore security rules using the Admin SDK service account.
// Avoids the firebase CLI's serviceusage pre-check (which the default
// firebase-adminsdk service account isn't permissioned for). Run:
//   npx tsx scripts/deploy-rules.ts

import { initializeApp, cert } from "firebase-admin/app";
import { getSecurityRules } from "firebase-admin/security-rules";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sa = JSON.parse(readFileSync(resolve("serviceAccountKey.json"), "utf8"));
initializeApp({ credential: cert(sa) });

async function main() {
  const rules = readFileSync(resolve("firestore.rules"), "utf8");
  await getSecurityRules().releaseFirestoreRulesetFromSource(rules);
  console.log(`✓ Firestore rules deployed to ${sa.project_id}`);
}

main().catch((e) => {
  console.error("Rules deploy failed:", e?.message ?? e);
  process.exit(1);
});
