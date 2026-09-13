import { makeUser, api, cleanup, makeChecker } from "./testkit";

async function main() {
  const { check, summary } = makeChecker();
  const u = await makeUser({
    email: `smoke_${Date.now()}@lumina-test.dev`,
    status: "pending",
  });
  check("minted a real ID token", !!u.idToken && u.idToken.length > 100);

  const boot = await api(u.idToken, "/api/user/bootstrap", {
    method: "POST",
    body: "{}",
  });
  check("authed /api/user/bootstrap → 200", boot.status === 200, `status=${boot.status}`);
  check("bootstrap returns pending profile", boot.body?.status === "pending", `got ${boot.body?.status}`);

  const noauth = await api(null, "/api/user/bootstrap", { method: "POST", body: "{}" });
  check("no-token /api/user/bootstrap → 401", noauth.status === 401, `status=${noauth.status}`);

  await cleanup(u.uid);
  const s = summary();
  process.exit(s.failed ? 1 : 0);
}
main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(1);
});
