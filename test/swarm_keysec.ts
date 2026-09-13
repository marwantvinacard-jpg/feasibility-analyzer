// Per-user API key security suite.
// Run with:  npx tsx test/swarm_keysec.ts
import { makeUser, api, cleanup, makeChecker, db } from "./testkit";

const DUMMY_KEY = "AIza-DUMMY-DO-NOT-USE-abc123456789";
const DUMMY_NEEDLE = "AIza-DUMMY";

// A valid-shaped style object so generate-from-prompt reaches getGenAIForUser
// (i.e. the ApiKeyMissing check / decrypt+use path) instead of failing earlier
// on body validation.
const STYLE = {
  id: "keysec-style",
  title: "Minimalist Test",
  description: ["clean lines", "neutral palette"],
};

function genCall(token: string) {
  return api(token, "/api/generate-from-prompt", {
    method: "POST",
    body: JSON.stringify({ style: STYLE, userPrompt: "test corridor" }),
  });
}

async function main() {
  const { check, summary } = makeChecker();
  const email = `keysec_${Date.now()}@lumina-test.dev`;
  let uid = "";

  try {
    const u = await makeUser({ email, status: "active", role: "user" });
    uid = u.uid;
    const t = u.idToken;

    // --- 1. Active user, no key ---
    const status0 = await api(t, "/api/user/api-key/status");
    check(
      "1a. status no-key → 200 {hasApiKey:false}",
      status0.status === 200 && status0.body?.hasApiKey === false,
      `status=${status0.status} body=${JSON.stringify(status0.body)}`
    );

    const gen0 = await genCall(t);
    check(
      "1b. generation without key → 400 code no_api_key",
      gen0.status === 400 && gen0.body?.code === "no_api_key",
      `status=${gen0.status} body=${JSON.stringify(gen0.body)}`
    );

    // --- 2. Save dummy key ---
    const save = await api(t, "/api/user/api-key", {
      method: "POST",
      body: JSON.stringify({ apiKey: DUMMY_KEY }),
    });
    check(
      "2a. POST api-key → 200 {hasApiKey:true}",
      save.status === 200 && save.body?.hasApiKey === true,
      `status=${save.status} body=${JSON.stringify(save.body)}`
    );

    const status1 = await api(t, "/api/user/api-key/status");
    check(
      "2b. status after save → {hasApiKey:true}",
      status1.status === 200 && status1.body?.hasApiKey === true,
      `body=${JSON.stringify(status1.body)}`
    );

    const boot1 = await api(t, "/api/user/bootstrap", { method: "POST", body: "{}" });
    check(
      "2c. bootstrap profile.hasApiKey === true",
      boot1.status === 200 && boot1.body?.hasApiKey === true,
      `hasApiKey=${boot1.body?.hasApiKey}`
    );

    // --- 3. CRITICAL: encryption-at-rest ---
    const secretSnap = await db.doc(`users/${uid}/secret/apiKey`).get();
    const secretData = secretSnap.exists ? secretSnap.data() : null;
    const hasCryptoFields =
      !!secretData &&
      typeof secretData.ciphertext === "string" &&
      typeof secretData.iv === "string" &&
      typeof secretData.authTag === "string";
    check(
      "3a. secret doc has ciphertext/iv/authTag",
      hasCryptoFields,
      `fields=${secretData ? Object.keys(secretData).join(",") : "<none>"}`
    );
    const secretJson = JSON.stringify(secretData || {});
    const plaintextInDoc = secretJson.includes(DUMMY_NEEDLE);
    check(
      "3b. CRITICAL plaintext key NOT in stored doc (encryption-at-rest)",
      hasCryptoFields && !plaintextInDoc,
      plaintextInDoc ? "PLAINTEXT KEY FOUND IN FIRESTORE" : "no plaintext present"
    );

    // --- 4. No endpoint leaks the raw key ---
    const bootJson = JSON.stringify(boot1.body || {});
    check(
      "4a. /api/user/bootstrap response does not leak key",
      !bootJson.includes(DUMMY_NEEDLE),
      bootJson.includes(DUMMY_NEEDLE) ? "LEAK" : "clean"
    );
    const statJson = JSON.stringify(status1.body || {});
    check(
      "4b. /api/user/api-key/status response does not leak key",
      !statJson.includes(DUMMY_NEEDLE),
      statJson.includes(DUMMY_NEEDLE) ? "LEAK" : "clean"
    );

    // Admin view: create a real admin to hit /api/admin/users.
    const adminEmail = `keysec_admin_${Date.now()}@lumina-test.dev`;
    let adminUid = "";
    try {
      const adminU = await makeUser({ email: adminEmail, status: "active", role: "admin" });
      adminUid = adminU.uid;
      const adminList = await api(adminU.idToken, "/api/admin/users");
      const listJson = JSON.stringify(adminList.body || {});
      const myUserPresent = Array.isArray(adminList.body?.users)
        ? adminList.body.users.some((x: any) => x.uid === uid)
        : false;
      check(
        "4c. admin list includes our test user (shape check)",
        adminList.status === 200 && myUserPresent,
        `status=${adminList.status} present=${myUserPresent}`
      );
      check(
        "4d. /api/admin/users response does not leak key",
        !listJson.includes(DUMMY_NEEDLE),
        listJson.includes(DUMMY_NEEDLE) ? "LEAK" : "clean"
      );
    } finally {
      if (adminUid) await cleanup(adminUid);
    }

    // --- 5. Key set: generation now reaches Gemini and fails on invalid key ---
    const gen1 = await genCall(t);
    const reachedGemini =
      gen1.body?.code !== "no_api_key" &&
      (gen1.status === 500 ||
        /gemini|api key|api_key|permission|invalid|denied|unauthenticated|400/i.test(
          JSON.stringify(gen1.body || {})
        ));
    check(
      "5. generation with key reaches Gemini + fails on bad key (not no_api_key)",
      reachedGemini && gen1.body?.code !== "no_api_key",
      `status=${gen1.status} body=${JSON.stringify(gen1.body).slice(0, 200)}`
    );

    // --- 6. Delete key ---
    const del = await api(t, "/api/user/api-key", { method: "DELETE" });
    check(
      "6a. DELETE api-key → {hasApiKey:false}",
      del.status === 200 && del.body?.hasApiKey === false,
      `status=${del.status} body=${JSON.stringify(del.body)}`
    );
    const secretGone = await db.doc(`users/${uid}/secret/apiKey`).get();
    check(
      "6b. secret doc removed after delete",
      !secretGone.exists,
      `exists=${secretGone.exists}`
    );
    const boot2 = await api(t, "/api/user/bootstrap", { method: "POST", body: "{}" });
    check(
      "6c. bootstrap profile.hasApiKey === false after delete",
      boot2.status === 200 && boot2.body?.hasApiKey === false,
      `hasApiKey=${boot2.body?.hasApiKey}`
    );
  } finally {
    if (uid) await cleanup(uid);
  }

  const s = summary();
  process.exit(s.failed ? 1 : 0);
}

main().catch((e) => {
  console.error("keysec crashed:", e);
  process.exit(1);
});
