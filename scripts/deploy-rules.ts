// Deploy firestore.rules + storage.rules via the Firebase CLI. Requires
// `firebase login` once, and a .firebaserc pointing at your project (copy
// .firebaserc.example). Run:
//   npx tsx scripts/deploy-rules.ts
import { execSync } from "node:child_process";

execSync("npx firebase-tools deploy --only firestore:rules,storage:rules", { stdio: "inherit" });
