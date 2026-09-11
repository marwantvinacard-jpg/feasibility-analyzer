import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const sa = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url), "utf8"));
initializeApp({ credential: cert(sa) });
const uname = process.argv[2];
const db = getFirestore();
const unameDoc = await db.collection("usernames").doc(uname).get();
if (!unameDoc.exists) { console.log("no username doc"); process.exit(0); }
const { uid } = unameDoc.data();
const userDoc = await db.collection("users").doc(uid).get();
console.log(JSON.stringify(userDoc.data(), null, 1));
process.exit(0);
