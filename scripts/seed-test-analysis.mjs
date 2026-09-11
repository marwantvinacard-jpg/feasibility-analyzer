import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
const sa = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url), "utf8"));
initializeApp({ credential: cert(sa) });
const auth = getAuth();
const db = getFirestore();
const uname = process.argv[2];
const unameDoc = await db.collection("usernames").doc(uname).get();
const { uid } = unameDoc.data();
const ref = db.collection("analyses").doc();
await ref.set({
  id: ref.id, uid, createdAt: Date.now(), status: "complete", charged: true, reviewStatus: "unreviewed",
  input: { business_idea: "Delete-test analysis", target_customer: "n/a", location: "n/a", problem_solved: "n/a",
    product_service: "n/a", revenue_model: "n/a", competitors: "n/a", monthly_cost: 1000, monthly_revenue: 2000,
    unique_advantage: "n/a", currency: "USD" },
  stageStatus: { market:"done",financial:"done",technical:"done",competitive:"done",location:"done",operational:"done",legal:"done",risk:"done" },
  result: null,
});
console.log(`created ${ref.id} for ${uname}`);
process.exit(0);
