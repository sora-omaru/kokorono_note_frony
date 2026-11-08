// 明示的な npm run test:integration 専用。起動中のlocalhostとDocker上のローカルDBだけを使用する。
// テスト用Account/Refresh Tokenを作成し、finallyで削除する。Google認証の成功を代替しない。
import "server-only";
import assert from "node:assert/strict";
import { createHash, createPrivateKey, randomBytes, randomUUID, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { openSession, sealSession, SESSION_COOKIE, type Session } from "../lib/server/session";

function variables(path: string) {
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/)
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).trim()]; }));
}
const back = resolve(process.cwd(), "../kokorono_note_api");
const frontendEnv = variables(".env.local");
assert.equal(frontendEnv.API_BASE_URL, "http://localhost:8080", "Integration test requires the local backend");
process.env.AUTH_SESSION_SECRET = frontendEnv.AUTH_SESSION_SECRET;
const backendEnv = variables(resolve(back, ".env"));
const privateKey = createPrivateKey({ key: Buffer.from(backendEnv.JWT_PRIVATE_KEY, "base64"), format: "der", type: "pkcs8" });
function sql(statement: string) {
  const result = spawnSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-U", "kokorono_note", "-d", "kokorono_note", "-v", "ON_ERROR_STOP=1"],
    { cwd: back, input: statement, encoding: "utf8" });
  assert.equal(result.status, 0, "Local fixture SQL failed");
}
function token(id: string, expired = false) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: id, iat: now - 3600, exp: now + (expired ? -600 : 900) })).toString("base64url");
  const input = `${header}.${payload}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
}
function cookie(current: Session) { return `${SESSION_COOKIE}=${sealSession(current)}`; }
function returnedSession(response: Response) {
  const value = response.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`))!
    .split(";", 1)[0].slice(SESSION_COOKIE.length + 1);
  return openSession(value)!;
}
async function run() {
  const id = randomUUID();
  const other = randomUUID();
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  let workspaceId: string | undefined;
  sql(`BEGIN; INSERT INTO account(id,google_sub) VALUES ('${id}','integration-${id}'),('${other}','integration-${other}');
INSERT INTO refresh_token(account_id,token_hash,expires_at) VALUES ('${id}','${hash}',NOW()+INTERVAL '1 day'); COMMIT;`);
  try {
    let current: Session = { accessToken: token(id), refreshToken: raw, expiresAt: Date.now() + 86400000 };
    const url = "http://localhost:3000/api/workspaces";
    const unauthenticated = await fetch(url);
    assert.equal(unauthenticated.status, 401);
    const created = await fetch(url, { method: "POST", headers: {
      Cookie: cookie(current), Origin: "http://localhost:3000", "Content-Type": "application/json",
    }, body: JSON.stringify({ name: "認証連携テスト" }) });
    assert.equal(created.status, 201, "BFF mutation must pass real CSRF checks");
    workspaceId = (await created.json()).id;
    current = returnedSession(created);
    assert.ok(current.backendSession);
    const list = await fetch(url, { headers: { Cookie: cookie(current) } });
    assert.equal(list.status, 200);
    assert.ok((await list.json()).some((w: { id: string }) => w.id === workspaceId));
    const privateList = await fetch(url, { headers: { Cookie: cookie({ ...current, accessToken: token(other) }) } });
    assert.equal(privateList.status, 200);
    assert.deepEqual(await privateList.json(), []);
    const rejected = await fetch(url, { method: "POST", headers: {
      Cookie: cookie(current), Origin: "https://attacker.test", "Content-Type": "application/json",
    }, body: '{"name":"forbidden"}' });
    assert.equal(rejected.status, 403);

    const oldCookie = cookie({ ...current, accessToken: token(id, true) });
    const parallel = await Promise.all([1, 2].map(() => fetch(url, { headers: { Cookie: oldCookie } })));
    assert.ok(parallel.every((res) => res.status === 200), "Expired JWT must refresh across concurrent BFF requests");
    const first = returnedSession(parallel[0]);
    const second = returnedSession(parallel[1]);
    assert.notEqual(first.refreshToken, current.refreshToken);
    assert.equal(first.refreshToken, second.refreshToken);
    current = first;
    const newHash = createHash("sha256").update(current.refreshToken).digest("hex");
    sql(`UPDATE refresh_token SET expires_at=NOW()-INTERVAL '1 day' WHERE token_hash='${newHash}';`);
    const expired = await fetch(url, { headers: { Cookie: cookie({ ...current, accessToken: token(id, true) }) } });
    assert.equal(expired.status, 401);
    assert.match(expired.headers.get("set-cookie")!, /Max-Age=0/);

    const page = await fetch("http://localhost:3000/workspaces");
    assert.match(await page.text(), /\/login/);
    console.log("PASS: real BFF/API/DB list, CSRF mutation, user isolation, origin rejection, concurrent refresh, expired refresh, and unauthenticated page.");
  } finally {
    sql(`BEGIN; DELETE FROM workspace WHERE id IN (SELECT workspace_id FROM workspace_account WHERE account_id='${id}');
DELETE FROM account WHERE id IN ('${id}','${other}'); COMMIT;`);
  }
}
run().catch(() => { console.error("Local API integration failed; no credentials were logged."); process.exitCode = 1; });
