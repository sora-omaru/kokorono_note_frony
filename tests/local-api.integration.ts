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
  const result = spawnSync("docker", ["compose", "exec", "-T", "postgres", "psql", "-tA", "-U", "kokorono_note", "-d", "kokorono_note", "-v", "ON_ERROR_STOP=1"],
    { cwd: back, input: statement, encoding: "utf8" });
  assert.equal(result.status, 0, "Local fixture SQL failed");
  return result.stdout.trim();
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

/** 起動中のBFF→Spring Boot→ローカルDBで、階層全体の契約と認可を検証する。 */
async function verifyEntries(workspaceId: string, owner: Session, outsider: Session): Promise<Session> {
  let current = owner;
  let foreignSession = outsider;
  const base = `http://localhost:3000/api/workspaces/${workspaceId}/events`;
  const origin = "http://localhost:3000";
  type Named = { id: string; name: string };
  type Note = { id: string; content: string };

  async function send(path: string, method = "GET", body?: unknown, foreign = false) {
    const headers: Record<string, string> = { Cookie: cookie(foreign ? foreignSession : current) };
    if (method !== "GET") headers.Origin = origin;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const result = await fetch(path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (result.headers.getSetCookie().some((value) => value.startsWith(`${SESSION_COOKIE}=`))) {
      const updated = returnedSession(result);
      assert.ok(updated, "Hierarchy requests must retain a valid session");
      if (foreign) foreignSession = updated;
      else current = updated;
    }
    return result;
  }
  async function named(path: string, method: string, name: string): Promise<Named> {
    const result = await send(path, method, { name });
    assert.equal(result.status, method === "POST" ? 201 : 200, `Hierarchy ${method} name operation failed`);
    const item = await result.json() as Named;
    assert.match(item.id, /^[1-9]\d*$/, "Hierarchy IDs must be decimal strings");
    assert.equal(item.name, name.trim());
    return item;
  }
  async function note(path: string, method: string, content: string): Promise<Note> {
    const result = await send(path, method, { content });
    assert.equal(result.status, method === "POST" ? 201 : 200, `Hierarchy ${method} content operation failed`);
    const item = await result.json() as Note;
    assert.match(item.id, /^[1-9]\d*$/, "Note IDs must remain strings");
    assert.equal(item.content, content.trim());
    return item;
  }
  async function list<T>(path: string): Promise<T[]> {
    const result = await send(path);
    assert.equal(result.status, 200, "Hierarchy list request failed");
    return await result.json() as T[];
  }
  async function remove(path: string) {
    const result = await send(path, "DELETE");
    assert.equal(result.status, 204, "Hierarchy deletion must succeed");
    assert.equal(await result.text(), "", "A 204 response must have no body");
  }
  async function absent(path: string, method = "GET", body?: unknown, foreign = false) {
    assert.equal((await send(path, method, body, foreign)).status, 404, "A missing or inaccessible child must not be exposed or changed");
  }

  assert.deepEqual(await list(base), []);
  const firstEvent = await named(base, "POST", "  旅行  ");
  const secondEvent = await named(base, "POST", "名".repeat(100));
  const firstEventUrl = `${base}/${firstEvent.id}`;
  const secondEventUrl = `${base}/${secondEvent.id}`;
  assert.equal((await send(firstEventUrl)).status, 200);
  await named(firstEventUrl, "PATCH", "  次の旅行  ");
  assert.deepEqual((await list<Named>(base)).map((item) => item.id), [firstEvent.id, secondEvent.id], "Event edits must preserve registration order");

  const categories = `${firstEventUrl}/categories`;
  const firstCategory = await named(categories, "POST", "分".repeat(100));
  const secondCategory = await named(categories, "POST", "注意点");
  const otherCategory = await named(`${secondEventUrl}/categories`, "POST", "別の出来事の分類");
  const firstCategoryUrl = `${categories}/${firstCategory.id}`;
  const secondCategoryUrl = `${categories}/${secondCategory.id}`;
  const otherCategoryUrl = `${secondEventUrl}/categories/${otherCategory.id}`;
  await named(firstCategoryUrl, "PATCH", "  持ち物  ");
  assert.deepEqual((await list<Named>(categories)).map((item) => item.id), [firstCategory.id, secondCategory.id], "Category edits must preserve registration order");

  const notes = `${firstCategoryUrl}/notes`;
  const firstNote = await note(notes, "POST", '持ち物のメモ\n本文中の {"id":9007199254740993} は文章です。');
  const secondNote = await note(notes, "POST", "文".repeat(255));
  const firstNoteUrl = `${notes}/${firstNote.id}`;
  const secondNoteUrl = `${notes}/${secondNote.id}`;
  const changedNote = '更新したメモ\n{"id":9223372036854775807} も本文のまま残す。';
  await note(firstNoteUrl, "PATCH", `  ${changedNote}  `);
  await note(secondNoteUrl, "PATCH", "改".repeat(255));
  const notesAfterEdit = await list<Note>(notes);
  assert.deepEqual(notesAfterEdit.map((item) => item.id), [firstNote.id, secondNote.id], "Note edits must not move the item");
  assert.equal(notesAfterEdit[0].content, changedNote, "ID-like text inside a note must not be rewritten");

  for (const [path, field, limit, method] of [
    [base, "name", 100, "POST"], [firstEventUrl, "name", 100, "PATCH"],
    [categories, "name", 100, "POST"], [firstCategoryUrl, "name", 100, "PATCH"],
    [notes, "content", 255, "POST"], [firstNoteUrl, "content", 255, "PATCH"],
  ] as const) {
    for (const invalid of [" \n ", "あ".repeat(limit + 1)]) {
      assert.equal((await send(path, method, { [field]: invalid })).status, 400, "Blank and overlong hierarchy input must be rejected");
    }
  }
  for (const invalidId of ["0", "-1", "abc", "9223372036854775808"]) {
    assert.equal((await send(`${base}/${invalidId}`)).status, 400, "Malformed or overflowing Long IDs must be rejected");
  }
  const unsupported = await send(base, "PATCH", { name: "unsupported" });
  assert.equal(unsupported.status, 405);

  // 非所属アカウントは各階層の取得・作成・更新・削除をすべて拒否される。
  for (const [collection, single, field] of [
    [base, firstEventUrl, "name"], [categories, firstCategoryUrl, "name"], [notes, firstNoteUrl, "content"],
  ] as const) {
    await absent(collection, "GET", undefined, true);
    await absent(collection, "POST", { [field]: "forbidden" }, true);
    await absent(single, "GET", undefined, true);
    await absent(single, "PATCH", { [field]: "forbidden" }, true);
    await absent(single, "DELETE", undefined, true);
  }

  // 所属済みWorkspace間、および同じWorkspace内でも親子関係を取り違えたURLは拒否する。
  const extraWorkspace = await send("http://localhost:3000/api/workspaces", "POST", { name: "親子関係テスト用" });
  assert.equal(extraWorkspace.status, 201);
  const extraWorkspaceId = (await extraWorkspace.json()).id as string;
  assert.match(extraWorkspaceId, /^[0-9a-f-]{36}$/i);
  const wrongWorkspaceEvent = `http://localhost:3000/api/workspaces/${extraWorkspaceId}/events/${firstEvent.id}`;
  const wrongEventCategory = `${secondEventUrl}/categories/${firstCategory.id}`;
  const wrongCategoryNote = `${secondCategoryUrl}/notes/${firstNote.id}`;
  for (const [path, field] of [[wrongWorkspaceEvent, "name"], [wrongEventCategory, "name"], [wrongCategoryNote, "content"]] as const) {
    await absent(path);
    await absent(path, "PATCH", { [field]: "wrong parent" });
    await absent(path, "DELETE");
  }
  assert.equal((await send(firstNoteUrl)).status, 200, "A rejected wrong-parent deletion must leave the original note intact");

  await remove(secondNoteUrl);
  await absent(secondNoteUrl);
  assert.deepEqual((await list<Note>(notes)).map((item) => item.id), [firstNote.id]);
  const categoryChild = await note(notes, "POST", "分類削除で消えるメモ");
  await remove(firstCategoryUrl);
  await absent(firstCategoryUrl);
  await absent(firstNoteUrl);
  await absent(`${notes}/${categoryChild.id}`);
  assert.equal(sql(`SELECT (SELECT count(*) FROM category WHERE id=${firstCategory.id}) + (SELECT count(*) FROM note WHERE id IN (${firstNote.id},${categoryChild.id}));`), "0", "Category deletion must cascade to its notes");
  const eventChild = await note(`${secondCategoryUrl}/notes`, "POST", "出来事削除で消えるメモ");
  const survivingNote = await note(`${otherCategoryUrl}/notes`, "POST", "別の出来事のメモは残る");
  await remove(firstEventUrl);
  await absent(firstEventUrl);
  await absent(secondCategoryUrl);
  await absent(`${secondCategoryUrl}/notes/${eventChild.id}`);
  assert.equal(sql(`SELECT (SELECT count(*) FROM event WHERE id=${firstEvent.id}) + (SELECT count(*) FROM category WHERE id=${secondCategory.id}) + (SELECT count(*) FROM note WHERE id=${eventChild.id});`), "0", "Event deletion must cascade to its categories and notes");
  assert.equal((await send(`${otherCategoryUrl}/notes/${survivingNote.id}`)).status, 200, "Deleting one Event must not affect another Event");
  await remove(secondEventUrl);

  // JSの安全な整数範囲を超える実DB IDでも、BFFを通じて同じIDを操作できる。
  const largeId = "9007199254740993";
  sql(`INSERT INTO event(id,workspace_id,name) OVERRIDING SYSTEM VALUE VALUES (${largeId},'${workspaceId}','大きいIDの検証');`);
  const large = await send(`${base}/${largeId}`);
  assert.equal(large.status, 200);
  assert.equal((await large.json()).id, largeId, "Long IDs must retain all digits across the BFF");
  await named(`${base}/${largeId}`, "PATCH", "精度を保って更新");
  await remove(`${base}/${largeId}`);
  await remove(`http://localhost:3000/api/workspaces/${extraWorkspaceId}`);
  assert.deepEqual(await list(base), []);
  console.log("PASS: hierarchy CRUD, registration order, input boundaries, parent/permission checks, cascade deletion, and lossless Long IDs.");
  return current;
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
    const detailUrl = `${url}/${workspaceId}`;
    const detail = await fetch(detailUrl, { headers: { Cookie: cookie(current) } });
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).name, "認証連携テスト");
    const outsiderCookie = cookie({ ...current, accessToken: token(other) });
    assert.equal((await fetch(detailUrl, { headers: { Cookie: outsiderCookie } })).status, 404);
    assert.equal((await fetch(detailUrl, { method: "DELETE", headers: { Cookie: outsiderCookie, Origin: "http://localhost:3000" } })).status, 404);
    const persisted = await fetch(detailUrl, { headers: { Cookie: cookie(current) } });
    assert.equal(persisted.status, 200, "Workspace must remain after an outsider's deletion attempt");
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

    current = await verifyEntries(workspaceId!, current, { ...current, accessToken: token(other) });

    // 配下の実データを用意し、Workspace削除時のDBカスケードも確認する。
    const children = sql(`WITH e AS (INSERT INTO event(workspace_id,name) VALUES ('${workspaceId}','test event') RETURNING id),
c AS (INSERT INTO category(event_id,name) SELECT id,'test category' FROM e RETURNING id),
n AS (INSERT INTO note(category_id,content) SELECT id,'test note' FROM c RETURNING id)
SELECT e.id || ':' || c.id || ':' || n.id FROM e,c,n;`).split(":");
    assert.equal(children.length, 3);
    assert.ok(children.every((value) => /^\d+$/.test(value)));
    const inviteCode = randomBytes(3).toString("hex").toUpperCase();
    sql(`INSERT INTO workspace_invite(workspace_id,code,expires_at) VALUES ('${workspaceId}','${inviteCode}',NOW()+INTERVAL '30 minutes');`);
    const joined = await fetch(`${url}/join`, { method: "POST", headers: {
      Cookie: outsiderCookie, Origin: "http://localhost:3000", "Content-Type": "application/json",
    }, body: JSON.stringify({ code: inviteCode }) });
    assert.equal(joined.status, 200);
    assert.equal((await joined.json()).id, workspaceId);
    const joinedCookie = cookie(returnedSession(joined));
    assert.equal((await fetch(detailUrl, { headers: { Cookie: joinedCookie } })).status, 200);
    const removed = await fetch(detailUrl, { method: "DELETE", headers: { Cookie: cookie(current), Origin: "http://localhost:3000" } });
    assert.equal(removed.status, 204);
    assert.equal(await removed.text(), "");
    assert.equal((await fetch(detailUrl, { headers: { Cookie: joinedCookie } })).status, 404);
    const afterDeletion = await fetch(url, { headers: { Cookie: cookie(current) } });
    assert.ok(!(await afterDeletion.json()).some((w: { id: string }) => w.id === workspaceId));
    assert.equal(sql(`SELECT (SELECT count(*) FROM event WHERE id=${children[0]}) +
(SELECT count(*) FROM category WHERE id=${children[1]}) + (SELECT count(*) FROM note WHERE id=${children[2]}) +
(SELECT count(*) FROM workspace_invite WHERE workspace_id='${workspaceId}') +
(SELECT count(*) FROM workspace_account WHERE workspace_id='${workspaceId}');`), "0", "Child data must be deleted with its Workspace");
    const newHash = createHash("sha256").update(current.refreshToken).digest("hex");
    sql(`UPDATE refresh_token SET expires_at=NOW()-INTERVAL '1 day' WHERE token_hash='${newHash}';`);
    const expired = await fetch(url, { headers: { Cookie: cookie({ ...current, accessToken: token(id, true) }) } });
    assert.equal(expired.status, 401);
    assert.match(expired.headers.get("set-cookie")!, /Max-Age=0/);

    const page = await fetch("http://localhost:3000/workspaces");
    assert.match(await page.text(), /\/login/);
    console.log("PASS: real Workspace create/read/delete, invite join, cascade deletion, access control, CSRF, concurrent refresh, and session expiry.");
  } finally {
    sql(`BEGIN; DELETE FROM workspace WHERE id IN (SELECT workspace_id FROM workspace_account WHERE account_id='${id}');
DELETE FROM account WHERE id IN ('${id}','${other}'); COMMIT;`);
  }
}
run().catch((error) => {
  const location = error instanceof Error ? error.stack?.match(/local-api\.integration\.ts:\d+:\d+/)?.[0] : undefined;
  console.error(`Local API integration failed${location ? ` at ${location}` : ""}; no credentials were logged.`);
  process.exitCode = 1;
});
