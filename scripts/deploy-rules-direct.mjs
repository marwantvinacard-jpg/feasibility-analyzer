// Deploys firestore.rules via the Admin SDK's Security Rules API instead of
// `firebase deploy`. The CLI's pre-deploy check calls serviceusage.googleapis.com
// to confirm the Firestore API is enabled, which this project's service
// account isn't granted — this bypasses that check entirely (rules releases
// only need Security Rules Admin, not Service Usage Viewer).
//   node scripts/deploy-rules-direct.mjs ./serviceAccountKey.json ./firestore.rules
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getSecurityRules } from "firebase-admin/security-rules";

const sa = JSON.parse(readFileSync(process.argv[2], "utf8"));
const rulesSource = readFileSync(process.argv[3], "utf8");
initializeApp({ credential: cert(sa) });

const securityRules = getSecurityRules();
const ruleset = await securityRules.createRuleset(
  securityRules.createRulesFileFromSource("firestore.rules", rulesSource)
);
await securityRules.releaseFirestoreRuleset(ruleset);
console.log("Deployed ruleset:", ruleset.name);
