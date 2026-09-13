// Security-rules audit (defense in depth) for Lumina Studio.
//
// Part A (static): assert firestore.rules / storage.rules match the intended
// access-control model by parsing the rule text.
// Part B (live probe): sign in with the real Firebase CLIENT SDK and prove the
// browser cannot read Firestore directly under the live (default) rules.
//
// Run:  npx tsx test/swarm_rules.ts
import fs from "node:fs";
import path from "node:path";
import { makeUser, cleanup, makeChecker, adminAuth } from "./testkit";

import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, signInWithCustomToken, connectAuthEmulator } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const ROOT = process.cwd();

// Collapse whitespace so multi-line rule clauses match reliably.
function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

async function main() {
  const { check, summary } = makeChecker();

  // ------------------------------------------------------------------
  // Part A — static analysis of firestore.rules
  // ------------------------------------------------------------------
  const fsRulesRaw = fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8");
  const fsRules = norm(fsRulesRaw);

  // (a) owner + admin can read users/{uid}
  check(
    "A(a) users/{uid} read = owner || admin",
    /match \/users\/\{uid\} \{ \/\/[^]*?allow read: if isOwner\(uid\) \|\| isAdmin\(\);/.test(fsRules) ||
      /allow read: if isOwner\(uid\) \|\| isAdmin\(\);/.test(fsRules),
    "firestore.rules users read clause"
  );

  // (b1) create + delete of profiles denied
  check(
    "A(b) client cannot create/delete profiles",
    /allow create, delete: if false;/.test(fsRules),
    "allow create, delete: if false"
  );

  // (b2) owner update restricted to ONLY displayName (never status/role/hasApiKey/generationCount)
  const updateOnlyDisplayName =
    /allow update: if isOwner\(uid\) && request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\) \.hasOnly\(\['displayName'\]\);/.test(
      fsRules
    ) ||
    /allow update: if isOwner\(uid\)[^]*?affectedKeys\(\)[^]*?hasOnly\(\['displayName'\]\)/.test(fsRules);
  check(
    "A(b) owner update limited to displayName only",
    updateOnlyDisplayName,
    "hasOnly(['displayName']) — status/role/hasApiKey/generationCount not writable"
  );
  // Guard: ensure no protected field is ever whitelisted for client writes.
  check(
    "A(b) no protected field whitelisted for client write",
    !/hasOnly\(\[[^\]]*(status|role|hasApiKey|generationCount)[^\]]*\]\)/.test(fsRules),
    "protected fields absent from any hasOnly() whitelist"
  );

  // (c) users/{uid}/secret/** fully denied to all clients
  check(
    "A(c) users/{uid}/secret/** denied to all clients",
    /match \/secret\/\{doc\} \{ allow read, write: if false; \}/.test(fsRules),
    "secret subcollection read+write: if false"
  );

  // (d) generations read-only owner+admin, client writes denied
  check(
    "A(d) generations read = owner||admin, write denied",
    /match \/generations\/\{genId\} \{ allow read: if isOwner\(uid\) \|\| isAdmin\(\); allow write: if false; \}/.test(
      fsRules
    ),
    "generations read owner||admin; write:false"
  );

  // Sanity: no blanket allow-all in firestore rules
  check(
    "A firestore has no blanket allow if true",
    !/allow (read|write|read, write|create|update|delete)[^;]*: if true;/.test(fsRules),
    "no 'if true' grants"
  );

  // ------------------------------------------------------------------
  // Part A — static analysis of storage.rules
  // ------------------------------------------------------------------
  const stRulesRaw = fs.readFileSync(path.join(ROOT, "storage.rules"), "utf8");
  const stRules = norm(stRulesRaw);

  // (e) storage users/{uid}/** owner+admin read, client-write denied
  check(
    "A(e) storage users/{uid}/** read = owner||admin",
    /match \/users\/\{uid\}\/\{allPaths=\*\*\} \{ allow read: if request\.auth != null && \(request\.auth\.uid == uid \|\| isAdmin\(\)\);/.test(
      stRules
    ),
    "storage read owner||admin"
  );
  check(
    "A(e) storage client writes denied",
    /match \/users\/\{uid\}\/\{allPaths=\*\*\}[^]*?allow write: if false;/.test(stRules),
    "storage write: if false"
  );
  check(
    "A storage has no blanket allow if true",
    !/allow (read|write)[^;]*: if true;/.test(stRules),
    "no 'if true' grants in storage.rules"
  );

  // ------------------------------------------------------------------
  // Part B — live probe: client SDK must NOT read Firestore directly
  // ------------------------------------------------------------------
  let uid: string | null = null;
  let clientApp: ReturnType<typeof initializeApp> | null = null;
  try {
    const user = await makeUser({
      email: `rules_${Date.now()}@lumina-test.dev`,
      status: "active",
      role: "user",
    });
    uid = user.uid;

    // Sign in with the CLIENT SDK exactly like the browser would.
    const firebaseConfig = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
    };
    clientApp = initializeApp(firebaseConfig, `probe-${Date.now()}`);
    const clientAuth = getAuth(clientApp);
    const customToken = await adminAuth.createCustomToken(uid);
    const cred = await signInWithCustomToken(clientAuth, customToken);
    check(
      "B client SDK signed in with custom token",
      cred.user?.uid === uid,
      `client uid=${cred.user?.uid}`
    );

    const clientDb = getFirestore(clientApp);

    // Attempt 1: read own profile doc directly from the client.
    let profileDenied = false;
    let profileDetail = "";
    try {
      const snap = await getDoc(doc(clientDb, "users", uid));
      profileDenied = false;
      profileDetail = snap.exists()
        ? `LEAK: client read profile data keys=${Object.keys(snap.data()).join(",")}`
        : "read returned no-exists (still allowed by rules — unexpected)";
    } catch (e: any) {
      const code = e?.code || e?.message || String(e);
      profileDenied = /permission-denied|insufficient permissions|Missing or insufficient/i.test(
        code
      );
      profileDetail = `error=${code}`;
    }
    check(
      "B client direct read of users/{uid} is DENIED (no data leak)",
      profileDenied,
      profileDetail
    );

    // Attempt 2: read the encrypted-secret subdoc directly from the client.
    let secretDenied = false;
    let secretDetail = "";
    try {
      const snap = await getDoc(doc(clientDb, "users", uid, "secret", "apiKey"));
      secretDenied = false;
      secretDetail = snap.exists()
        ? `LEAK: client read secret data keys=${Object.keys(snap.data()).join(",")}`
        : "read returned no-exists (still allowed by rules — unexpected)";
    } catch (e: any) {
      const code = e?.code || e?.message || String(e);
      secretDenied = /permission-denied|insufficient permissions|Missing or insufficient/i.test(
        code
      );
      secretDetail = `error=${code}`;
    }
    check(
      "B client direct read of users/{uid}/secret/apiKey is DENIED",
      secretDenied,
      secretDetail
    );
  } finally {
    if (clientApp) {
      try {
        await deleteApp(clientApp);
      } catch {}
    }
    if (uid) await cleanup(uid);
  }

  const s = summary();
  process.exit(s.failed ? 1 : 0);
}

main().catch((e) => {
  console.error("swarm_rules crashed:", e);
  process.exit(1);
});
