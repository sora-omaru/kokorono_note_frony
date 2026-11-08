import { afterEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { BackendClient, ApiError } from "../lib/server/backend";
import { sealSession, SESSION_COOKIE, type Session } from "../lib/server/session";
import { isEntryId } from "../lib/entries";
import { GET, POST, PATCH, DELETE } from "../app/api/workspaces/[workspaceId]/events/[[...segments]]/route";

process.env.AUTH_SESSION_SECRET = "bc".repeat(32);
process.env.API_BASE_URL = "http://backend.test";
afterEach(() => mock.restoreAll());

const workspaceId = "01234567-89ab-4cde-8f01-23456789abcd";
const base = `/api/v1/workspaces/${workspaceId}/events`;
function session(): Session {
  return { accessToken: "access", refreshToken: "entries-refresh", expiresAt: Date.now() + 86400000 };
}
function request(method = "GET", body?: string, authenticated = true, origin = "http://localhost:3000") {
  const headers: Record<string, string> = { Origin: origin, "Content-Type": "application/json" };
  if (authenticated) headers.Cookie = `${SESSION_COOKIE}=${sealSession(session())}`;
  return new NextRequest("http://localhost:3000/api/workspaces/id/events", { method, headers, body });
}
function context(segments?: string[], id = workspaceId) {
  return { params: Promise.resolve({ workspaceId: id, segments }) };
}
function csrf() {
  return Response.json({ headerName: "X-CSRF-TOKEN", token: "csrf-value" }, { headers: { "Set-Cookie": "JSESSIONID=csrf-session; Path=/; HttpOnly" } });
}

test("entry URL IDs cover the positive Long range without rounding", () => {
  for (const id of ["1", "9007199254740993", "9223372036854775807"]) assert.equal(isEntryId(id), true);
  for (const id of ["", "0", "-1", "01", "+1", "1.0", "1e3", "9223372036854775808", "12345678901234567890", "../1"]) assert.equal(isEntryId(id), false);
});

test("Long IDs are stringified before JSON.parse can lose precision", async () => {
  mock.method(globalThis, "fetch", async () => new Response('[{"id":9223372036854775807,"name":"last"},{"id":9007199254740993,"name":"large"}]'));
  const result = await GET(request(), context());
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), [
    { id: "9223372036854775807", name: "last" }, { id: "9007199254740993", name: "large" },
  ]);
});

test("ID-like text, escaped quotes, and backslashes in Note content remain unchanged", async () => {
  const content = 'line {"id":9223372036854775807}\\path\\\nquoted "text"';
  mock.method(globalThis, "fetch", async () => new Response('{"id":9007199254740993,"content":' + JSON.stringify(content) + '}'));
  const result = await GET(request(), context(["1", "categories", "2", "notes", "9007199254740993"]));
  assert.deepEqual(await result.json(), { id: "9007199254740993", content });
});

test("only numeric id fields change; nested keys and other numeric values survive", async () => {
  mock.method(globalThis, "fetch", async () => new Response('{"id":1,"other":1.5,"nested":{"i\\u0064":9223372036854775807},"text":"id","empty":null}'));
  const result = await new BackendClient(session()).call(base);
  assert.deepEqual(result, { id: "1", other: 1.5, nested: { id: "9223372036854775807" }, text: "id", empty: null });
});

test("all six supported route shapes map to the exact backend path", async () => {
  const paths = [[], ["10"], ["10", "categories"], ["10", "categories", "20"], ["10", "categories", "20", "notes"], ["10", "categories", "20", "notes", "30"]];
  for (const segments of paths) {
    const collection = segments.length % 2 === 0;
    const content = segments.length >= 4;
    const item = content ? { id: 30, content: "note" } : { id: 20, name: "name" };
    const mocked = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
      assert.equal(url, "http://backend.test" + base + (segments.length ? `/${segments.join("/")}` : ""));
      assert.equal(init.cache, "no-store");
      assert.equal(new Headers(init.headers).get("authorization"), "Bearer access");
      return Response.json(collection ? [item] : item);
    });
    const result = await GET(request(), context(segments));
    assert.equal(result.status, 200);
    const normalized = content ? { id: "30", content: "note" } : { id: "20", name: "name" };
    assert.deepEqual(await result.json(), collection ? [normalized] : normalized);
    assert.match(result.headers.get("cache-control")!, /no-store/);
    mocked.mock.restore();
  }
});

test("collections retain registration order instead of sorting by ID or content", async () => {
  mock.method(globalThis, "fetch", async () => Response.json([{ id: 9, content: "second alphabetically" }, { id: 2, content: "first alphabetically" }]));
  const result = await GET(request(), context(["1", "categories", "2", "notes"]));
  assert.deepEqual((await result.json()).map((item: { id: string }) => item.id), ["9", "2"]);
});

test("POST and PATCH validate and trim only their allowed field and send matching CSRF", async () => {
  for (const [method, handler, segments, field] of [
    ["POST", POST, [], "name"],
    ["PATCH", PATCH, ["1"], "name"],
    ["POST", POST, ["1", "categories"], "name"],
    ["PATCH", PATCH, ["1", "categories", "2"], "name"],
    ["POST", POST, ["1", "categories", "2", "notes"], "content"],
    ["PATCH", PATCH, ["1", "categories", "2", "notes", "3"], "content"],
  ] as const) {
    const mocked = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/csrf")) return csrf();
      assert.equal(url, "http://backend.test" + base + (segments.length ? `/${segments.join("/")}` : ""));
      assert.equal(init.method, method);
      assert.equal(new Headers(init.headers).get("cookie"), "JSESSIONID=csrf-session");
      assert.equal(new Headers(init.headers).get("X-CSRF-TOKEN"), "csrf-value");
      assert.equal(init.body, JSON.stringify({ [field]: "saved" }));
      return Response.json({ id: 3, [field]: "saved", private: "must-not-return" });
    });
    const result = await handler(request(method, JSON.stringify({ [field]: " saved ", ignored: "other" })), context([...segments]));
    assert.equal(result.status, method === "POST" ? 201 : 200);
    assert.deepEqual(await result.json(), { id: "3", [field]: "saved" });
    mocked.mock.restore();
  }
});

test("input validation rejects malformed JSON, blanks, missing fields, and overlong values before forwarding", async () => {
  const mocked = mock.method(globalThis, "fetch", async () => { throw new Error("Must not reach backend"); });
  for (const [segments, field, limit] of [[[], "name", 100], [["1", "categories"], "name", 100], [["1", "categories", "2", "notes"], "content", 255]] as const) {
    for (const body of ["{", "null", "[]", "{}", JSON.stringify({ [field]: 123 }), JSON.stringify({ [field]: " \n " }), JSON.stringify({ [field]: "a".repeat(limit + 1) })]) {
      assert.equal((await POST(request("POST", body), context([...segments]))).status, 400);
    }
  }
  assert.equal(mocked.mock.callCount(), 0);
});

test("name and content allow their exact DTO upper bounds", async () => {
  for (const [segments, field, limit] of [[[], "name", 100], [["1", "categories", "2", "notes"], "content", 255]] as const) {
    const mocked = mock.method(globalThis, "fetch", async (url: string) => url.endsWith("/auth/csrf") ? csrf() : Response.json({ id: 1, [field]: "a".repeat(limit) }));
    assert.equal((await POST(request("POST", JSON.stringify({ [field]: "a".repeat(limit) })), context([...segments]))).status, 201);
    mocked.mock.restore();
  }
});

test("invalid route IDs and non-whitelisted paths never reach the backend", async () => {
  const mocked = mock.method(globalThis, "fetch", async () => { throw new Error("Must not reach backend"); });
  assert.equal((await GET(request(), context([], "invalid"))).status, 400);
  for (const segments of [["0"], ["01"], ["1e2"], ["9223372036854775808"], ["../auth"], ["1", "categories", "-2"]]) {
    assert.equal((await GET(request(), context(segments))).status, 400);
  }
  for (const segments of [["1", "other"], ["1", "categories", "2", "other"], ["1", "categories", "2", "notes", "3", "extra"], ["1", "categories", "2", "notes", "3", "auth", "token"]]) {
    assert.equal((await GET(request(), context(segments))).status, 404);
  }
  assert.equal(mocked.mock.callCount(), 0);
});

test("method matrix rejects PATCH or DELETE on a collection and POST on an item", async () => {
  const mocked = mock.method(globalThis, "fetch", async () => { throw new Error("Must not reach backend"); });
  for (const [method, handler, segments, allowed] of [["PATCH", PATCH, [], "GET, POST"], ["DELETE", DELETE, ["1", "categories"], "GET, POST"], ["POST", POST, ["1"], "GET, PATCH, DELETE"]] as const) {
    const result = await handler(request(method, method === "DELETE" ? undefined : "{}"), context([...segments]));
    assert.equal(result.status, 405);
    assert.equal(result.headers.get("allow"), allowed);
  }
  assert.equal(mocked.mock.callCount(), 0);
});

test("all item DELETE routes use CSRF and return empty 204 responses", async () => {
  for (const segments of [["1"], ["1", "categories", "2"], ["1", "categories", "2", "notes", "3"]]) {
    const mocked = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/csrf")) return csrf();
      assert.equal(init.method, "DELETE");
      assert.equal(new Headers(init.headers).get("X-CSRF-TOKEN"), "csrf-value");
      return new Response(null, { status: 204 });
    });
    const result = await DELETE(request("DELETE"), context(segments));
    assert.equal(result.status, 204);
    assert.equal(await result.text(), "");
    mocked.mock.restore();
  }
});

test("authentication and same-origin checks apply before any hierarchy request", async () => {
  const mocked = mock.method(globalThis, "fetch", async () => { throw new Error("Must not reach backend"); });
  assert.equal((await GET(request("GET", undefined, false), context())).status, 401);
  for (const [method, handler, segments] of [["POST", POST, []], ["PATCH", PATCH, ["1"]], ["DELETE", DELETE, ["1"]]] as const) {
    assert.equal((await handler(request(method, method === "DELETE" ? undefined : "{}", true, "https://other.test"), context([...segments]))).status, 403);
  }
  assert.equal(mocked.mock.callCount(), 0);
});

test("backend access failures propagate without exposing data or retrying 403/404", async () => {
  for (const status of [403, 404]) {
    const mocked = mock.method(globalThis, "fetch", async () => new Response(null, { status }));
    const result = await GET(request(), context(["1", "categories", "2"]));
    assert.equal(result.status, status);
    assert.equal(mocked.mock.callCount(), 1);
    mocked.mock.restore();
  }
});

test("malformed JSON and invalid entry response shapes fail as a safe 502", async () => {
  for (const source of ["{", "null", '{"id":1,"name":"wrong collection"}', '[{"id":0,"name":"bad id"}]', '[{"id":1,"name":null}]']) {
    const mocked = mock.method(globalThis, "fetch", async () => new Response(source));
    const result = await GET(request(), context());
    assert.equal(result.status, 502);
    assert.deepEqual(await result.json(), { message: "APIの応答が不正です" });
    mocked.mock.restore();
  }
  mock.method(globalThis, "fetch", async () => new Response("{"));
  await assert.rejects(new BackendClient(session()).call(base), (error: ApiError) => error.status === 502);
});
