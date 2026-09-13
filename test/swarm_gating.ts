import { makeUser, mintIdToken, api, cleanup, makeChecker } from "./testkit";

const TAG = `gating_${Date.now()}`;
const email = (s: string) => `${TAG}_${s}@lumina-test.dev`;

// A tiny valid PNG (1x1) base64 so generate-style passes the image presence
// check and reaches the per-user API-key lookup.
const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const genBody = JSON.stringify({
  style: { id: "s1", title: "Test Style", description: ["clean", "minimal"] },
  targetImage: { base64: PNG_1x1, file: { type: "image/png" } },
  brandImages: [],
  userPrompt: "make it nice",
});

async function main() {
  const { check, summary } = makeChecker();
  const created: string[] = [];

  try {
    // ---- 1. No token -> 401 -----------------------------------------------
    const noTok = await api(null, "/api/generate-style", {
      method: "POST",
      body: "{}",
    });
    check(
      "1. no token -> 401 on POST /api/generate-style",
      noTok.status === 401,
      `status=${noTok.status}`
    );

    // ---- 2. Garbage token -> 401 ------------------------------------------
    const badTok = await api("garbage.invalid.token", "/api/generate-style", {
      method: "POST",
      body: "{}",
    });
    check(
      "2. invalid token -> 401",
      badTok.status === 401,
      `status=${badTok.status}`
    );

    // ---- 3. PENDING user -> 403 code=pending ------------------------------
    const pending = await makeUser({ email: email("pending"), status: "pending" });
    created.push(pending.uid);
    const pendGen = await api(pending.idToken, "/api/generate-style", {
      method: "POST",
      body: genBody,
    });
    check(
      "3. pending user -> 403 code=pending",
      pendGen.status === 403 && pendGen.body?.code === "pending",
      `status=${pendGen.status} code=${pendGen.body?.code}`
    );

    // ---- 4. DISABLED user -> 403 code=disabled ----------------------------
    const disabled = await makeUser({
      email: email("disabled"),
      status: "disabled",
    });
    created.push(disabled.uid);
    const disGen = await api(disabled.idToken, "/api/generate-style", {
      method: "POST",
      body: genBody,
    });
    check(
      "4. disabled user -> 403 code=disabled",
      disGen.status === 403 && disGen.body?.code === "disabled",
      `status=${disGen.status} code=${disGen.body?.code}`
    );

    // ---- 5. ACTIVE user (no key) -> gating passes, 400 no_api_key ---------
    const active = await makeUser({
      email: email("active"),
      status: "active",
      hasApiKey: false,
    });
    created.push(active.uid);
    const actGen = await api(active.idToken, "/api/generate-style", {
      method: "POST",
      body: genBody,
    });
    check(
      "5. active no-key -> not 401/403 (gating passes)",
      actGen.status !== 401 && actGen.status !== 403,
      `status=${actGen.status}`
    );
    check(
      "5b. active no-key -> 400 code=no_api_key",
      actGen.status === 400 && actGen.body?.code === "no_api_key",
      `status=${actGen.status} code=${actGen.body?.code}`
    );

    // ---- 6. Non-admin active user -> 403 on admin list --------------------
    const adminListAsUser = await api(active.idToken, "/api/admin/users");
    check(
      "6. non-admin active -> GET /api/admin/users 403",
      adminListAsUser.status === 403,
      `status=${adminListAsUser.status}`
    );

    // ---- 7. ADMIN user -> 200 with well-formed body ----------------------
    const adminUser = await makeUser({
      email: email("admin"),
      status: "active",
      role: "admin",
    });
    created.push(adminUser.uid);
    const adminList = await api(adminUser.idToken, "/api/admin/users");
    const b = adminList.body;
    const shapeOk =
      adminList.status === 200 &&
      Array.isArray(b?.users) &&
      b?.stats &&
      typeof b.stats.total === "number" &&
      typeof b.stats.pending === "number" &&
      typeof b.stats.active === "number" &&
      typeof b.stats.disabled === "number" &&
      typeof b?.totalGenerations === "number";
    check(
      "7. admin -> GET /api/admin/users 200 with users[]/stats/totalGenerations",
      shapeOk,
      `status=${adminList.status} keys=${b ? Object.keys(b).join(",") : "none"}`
    );
    // Assert our own users are present (never global counts).
    const uids = new Set((b?.users || []).map((u: any) => u.uid));
    check(
      "7b. admin list includes our own test users",
      uids.has(adminUser.uid) && uids.has(active.uid) && uids.has(pending.uid),
      `foundAdmin=${uids.has(adminUser.uid)} foundActive=${uids.has(active.uid)} foundPending=${uids.has(pending.uid)}`
    );

    // ---- 8. bootstrap reflects status for pending vs active --------------
    const bootPending = await api(pending.idToken, "/api/user/bootstrap", {
      method: "POST",
      body: "{}",
    });
    const bootActive = await api(active.idToken, "/api/user/bootstrap", {
      method: "POST",
      body: "{}",
    });
    check(
      "8. bootstrap pending user -> status=pending",
      bootPending.status === 200 && bootPending.body?.status === "pending",
      `status=${bootPending.status} bodyStatus=${bootPending.body?.status}`
    );
    check(
      "8b. bootstrap active user -> status=active",
      bootActive.status === 200 && bootActive.body?.status === "active",
      `status=${bootActive.status} bodyStatus=${bootActive.body?.status}`
    );

    // ---- 9. Admin actions on a target user ------------------------------
    const target = await makeUser({ email: email("target"), status: "pending" });
    created.push(target.uid);

    // 9a: activate target
    const setActive = await api(
      adminUser.idToken,
      `/api/admin/users/${target.uid}/status`,
      { method: "POST", body: JSON.stringify({ status: "active" }) }
    );
    const bootTargetActive = await api(target.idToken, "/api/user/bootstrap", {
      method: "POST",
      body: "{}",
    });
    check(
      "9a. admin set status=active -> target bootstrap active",
      setActive.status === 200 && bootTargetActive.body?.status === "active",
      `setStatus=${setActive.status} bootStatus=${bootTargetActive.body?.status}`
    );

    // 9b: disable target -> generate now 403 disabled
    const setDisabled = await api(
      adminUser.idToken,
      `/api/admin/users/${target.uid}/status`,
      { method: "POST", body: JSON.stringify({ status: "disabled" }) }
    );
    const targetGenDisabled = await api(target.idToken, "/api/generate-style", {
      method: "POST",
      body: genBody,
    });
    check(
      "9b. admin set status=disabled -> target generate 403 disabled",
      setDisabled.status === 200 &&
        targetGenDisabled.status === 403 &&
        targetGenDisabled.body?.code === "disabled",
      `setStatus=${setDisabled.status} genStatus=${targetGenDisabled.status} code=${targetGenDisabled.body?.code}`
    );

    // 9c: promote target to admin -> can list admin users
    const setRole = await api(
      adminUser.idToken,
      `/api/admin/users/${target.uid}/role`,
      { method: "POST", body: JSON.stringify({ role: "admin" }) }
    );
    // Promotion implies status=active; mint a fresh token (claims unchanged but safe)
    const targetToken = await mintIdToken(target.uid);
    const targetAdminList = await api(targetToken, "/api/admin/users");
    check(
      "9c. admin set role=admin -> target can GET /api/admin/users 200",
      setRole.status === 200 && targetAdminList.status === 200,
      `setRole=${setRole.status} listStatus=${targetAdminList.status}`
    );
  } finally {
    for (const uid of created) await cleanup(uid);
  }

  const s = summary();
  process.exit(s.failed ? 1 : 0);
}

main().catch((e) => {
  console.error("swarm_gating crashed:", e);
  process.exit(1);
});
