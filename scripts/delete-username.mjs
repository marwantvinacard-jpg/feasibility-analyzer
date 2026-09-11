import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const sa = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url), "utf8"));
initializeApp({ credential: cert(sa) });
await getFirestore().collection("usernames").doc(process.argv[2]).delete();
console.log(`removed usernames/${process.argv[2]}`);
process.exit(0);
