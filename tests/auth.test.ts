import { afterEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { ApiError, BackendClient, exchangeCode } from "../lib/server/backend";
import {
  openSession,
  sealSession,
  SESSION_COOKIE,
  FLOW_COOKIE,
  type Session,
} from "../lib/server/session";
import { GET, POST } from "../app/api/workspaces/route";
import { GET as callback } from "../app/oauth/callback/route";
import { GET as login } from "../app/auth/login/route";
import { GET as getWorkspace, DELETE as deleteWorkspace } from "../app/api/workspaces/[workspaceId]/route";
import { POST as joinWorkspace } from "../app/api/workspaces/join/route";

process.env.AUTH_SESSION_SECRET = "ab".repeat(32);
process.env.API_BASE_URL = "http://backend.test";
afterEach(() => mock.restoreAll());

function session(refreshToken = "refresh"): Session {
  return {
    accessToken: "access",
    refreshToken,
    expiresAt: Date.now() + 86400000,
  };
}
function response(data: unknown, cookies?: string) {
  return Response.json(data, {
    headers: cookies ? { "Set-Cookie": cookies } : {},
  });
}
function apiRequest(
  method = "GET",
  current?: Session,
  body?: string,
  origin = "http://localhost:3000",
) {
  const headers: Record<string, string> = {
    origin,
    "Content-Type": "application/json",
  };
  if (current) headers.Cookie = `${SESSION_COOKIE}=${sealSession(current)}`;
  return new NextRequest("http://localhost:3000/api/workspaces", {
    method,
    headers,
    body,
  });
}

test("session is confidential, authenticated, and expires", () => {
  const current = session();
  const cookie = sealSession(current);
  assert.ok(!cookie.includes("refresh"));
  assert.deepEqual(openSession(cookie), current);
  const tampered = Buffer.from(cookie, "base64url");
  tampered[30] ^= 1;
  assert.equal(openSession(tampered.toString("base64url")), undefined);
  assert.equal(
    openSession(sealSession({ ...current, expiresAt: Date.now() - 1 })),
    undefined,
  );
  assert.equal(openSession("invalid"), undefined);
});

test("code exchange retains the backend refresh cookie without exposing it in JSON", async () => {
  mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.equal(init.cache, "no-store");
    assert.equal(init.body, JSON.stringify({ code: "once" }));
    return response(
      { accessToken: "jwt" },
      "refreshToken=new-refresh; Path=/auth; HttpOnly",
    );
  });
  assert.equal((await exchangeCode("once")).refreshToken, "new-refresh");
});

test("login starts an OAuth flow; callback binds it to this browser", async () => {
  const start = await login(new Request("http://localhost:3000/auth/login"));
  const flow = start.cookies.get(FLOW_COOKIE)!.value;
  assert.equal(
    new URL(start.headers.get("location")!).searchParams.get("flow"),
    flow,
  );
  assert.match(start.headers.get("set-cookie")!, /HttpOnly/);
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    response({ accessToken: "jwt" }, "refreshToken=new-refresh; HttpOnly"),
  );
  const result = await callback(
    new NextRequest(
      `http://localhost:3000/oauth/callback?code=once&flow=${flow}`,
      {
        headers: { Cookie: `${FLOW_COOKIE}=${flow}` },
      },
    ),
  );
  assert.equal(
    new URL(result.headers.get("location")!).pathname,
    "/workspaces",
  );
  assert.equal(
    openSession(result.cookies.get(SESSION_COOKIE)?.value)?.refreshToken,
    "new-refresh",
  );
  assert.equal(result.cookies.get(FLOW_COOKIE)?.value, "");
  assert.equal(fetchMock.mock.callCount(), 1);
  for (const query of ["", "?code=once", `?code=once&flow=${"0".repeat(64)}`]) {
    const rejected = await callback(
      new NextRequest(`http://localhost:3000/oauth/callback${query}`, {
        headers: { Cookie: `${FLOW_COOKIE}=${flow}` },
      }),
    );
    assert.equal(
      new URL(rejected.headers.get("location")!).searchParams.get("error"),
      "oauth",
    );
  }
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("invalid or reused code goes back to login without session tokens", async () => {
  mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 400 }),
  );
  const flow = "a".repeat(64);
  const result = await callback(
    new NextRequest(
      `http://localhost:3000/oauth/callback?code=reused&flow=${flow}`,
      {
        headers: { Cookie: `${FLOW_COOKIE}=${flow}` },
      },
    ),
  );
  assert.equal(result.cookies.get(SESSION_COOKIE)?.value, "");
  assert.match(result.headers.get("location")!, /error=oauth/);
});

test("mutations send the matching CSRF session and header, and handle 204", async () => {
  mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url.endsWith("/auth/csrf")) {
      return response(
        { headerName: "X-CSRF-TOKEN", token: "csrf-token" },
        "JSESSIONID=backend-session; Path=/; HttpOnly",
      );
    }
    const headers = new Headers(init.headers);
    assert.equal(headers.get("authorization"), "Bearer access");
    assert.equal(headers.get("cookie"), "JSESSIONID=backend-session");
    assert.equal(headers.get("X-CSRF-TOKEN"), "csrf-token");
    return new Response(null, { status: 204 });
  });
  const client = new BackendClient(session());
  assert.equal(
    await client.call("/api/v1/workspaces/id", { method: "DELETE" }),
    undefined,
  );
  assert.equal(client.session.backendSession, "backend-session");
});

test("missing CSRF session fails closed without issuing a mutation", async () => {
  const mocked = mock.method(globalThis, "fetch", async () =>
    response({ headerName: "X-CSRF-TOKEN", token: "csrf" }));
  await assert.rejects(new BackendClient(session()).call("/api/v1/workspaces", { method: "POST", body: { name: "test" } }),
    (error: ApiError) => error.status === 502);
  assert.equal(mocked.mock.callCount(), 1);
});

test("a successful refresh is retained even if the retried request returns an input error", async () => {
  mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url.endsWith("/auth/csrf")) return response({ headerName: "X-CSRF-TOKEN", token: "csrf" }, "JSESSIONID=s; HttpOnly");
    if (url.endsWith("/auth/refresh")) return response({ accessToken: "new-access" }, "refreshToken=updated; HttpOnly");
    return new Response(null, { status: new Headers(init.headers).get("authorization") === "Bearer access" ? 401 : 400 });
  });
  const result = await POST(apiRequest("POST", session("refresh-before-validation-error"), '{"name":"valid"}'));
  assert.equal(result.status, 400);
  assert.equal(openSession(result.cookies.get(SESSION_COOKIE)?.value)?.refreshToken, "updated");
});

test("401 refreshes exactly once and retries with the rotated tokens", async () => {
  let calls = 0;
  let refreshed = 0;
  mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    if (url.endsWith("/auth/csrf")) {
      return response(
        { headerName: "X-CSRF-TOKEN", token: "csrf" },
        "JSESSIONID=refresh-session; HttpOnly",
      );
    }
    if (url.endsWith("/auth/refresh")) {
      refreshed++;
      assert.equal(
        headers.get("cookie"),
        "JSESSIONID=refresh-session; refreshToken=rotate-once",
      );
      assert.equal(headers.get("X-CSRF-TOKEN"), "csrf");
      return response(
        { accessToken: "new-access" },
        "refreshToken=new-refresh; HttpOnly",
      );
    }
    calls++;
    return headers.get("authorization") === "Bearer access"
      ? new Response(null, { status: 401 })
      : response([]);
  });
  const client = new BackendClient(session("rotate-once"));
  assert.deepEqual(await client.call("/api/v1/workspaces"), []);
  assert.equal(refreshed, 1);
  assert.equal(calls, 2);
  assert.equal(client.session.refreshToken, "new-refresh");
});

test("parallel requests using one old cookie share one refresh; users remain isolated", async () => {
  const counts = new Map<string, number>();
  mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    if (url.endsWith("/auth/csrf")) {
      return response(
        { headerName: "X-CSRF-TOKEN", token: "csrf" },
        "JSESSIONID=s; HttpOnly",
      );
    }
    if (url.endsWith("/auth/refresh")) {
      const token = headers.get("cookie")!.split("refreshToken=")[1];
      counts.set(token, (counts.get(token) ?? 0) + 1);
      await new Promise((resolve) => setTimeout(resolve, 20));
      return response(
        { accessToken: token },
        `refreshToken=rotated-${token}; HttpOnly`,
      );
    }
    return headers.get("authorization") === "Bearer access"
      ? new Response(null, { status: 401 })
      : response([{ id: headers.get("authorization"), name: "private" }]);
  });
  const clients = [
    new BackendClient(session("user-a")),
    new BackendClient(session("user-a")),
    new BackendClient(session("user-b")),
  ];
  const results = await Promise.all(
    clients.map((client) =>
      client.call<Array<{ id: string }>>("/api/v1/workspaces"),
    ),
  );
  assert.equal(counts.get("user-a"), 1);
  assert.equal(counts.get("user-b"), 1);
  assert.equal(results[0][0].id, "Bearer user-a");
  assert.equal(results[2][0].id, "Bearer user-b");
});

test("403 and 404 are not refreshed; a second 401 cannot loop", async () => {
  for (const status of [403, 404]) {
    const mocked = mock.method(
      globalThis,
      "fetch",
      async () => new Response(null, { status }),
    );
    await assert.rejects(
      new BackendClient(session()).call("/api/v1/workspaces"),
      (error: ApiError) => error.status === status,
    );
    assert.equal(mocked.mock.callCount(), 1);
    mocked.mock.restore();
  }
  let refreshed = 0;
  mock.method(globalThis, "fetch", async (url: string) => {
    if (url.endsWith("/auth/csrf"))
      return response(
        { headerName: "X-CSRF-TOKEN", token: "csrf" },
        "JSESSIONID=s; HttpOnly",
      );
    if (url.endsWith("/auth/refresh")) {
      refreshed++;
      return response(
        { accessToken: "still-invalid" },
        "refreshToken=replaced; HttpOnly",
      );
    }
    return new Response(null, { status: 401 });
  });
  await assert.rejects(
    new BackendClient(session("retry-limit")).call("/api/v1/workspaces"),
    (error: ApiError) => error.status === 401,
  );
  assert.equal(refreshed, 1);
});

test("invalid refresh clears cookies, while a transient outage preserves the session", async () => {
  mock.method(globalThis, "fetch", async (url: string) =>
    url.endsWith("/auth/csrf")
      ? response(
          { headerName: "X-CSRF-TOKEN", token: "csrf" },
          "JSESSIONID=s; HttpOnly",
        )
      : new Response(null, { status: 401 }),
  );
  const invalid = await GET(apiRequest("GET", session("invalid-refresh")));
  assert.equal(invalid.status, 401);
  assert.equal(invalid.cookies.get(SESSION_COOKIE)?.value, "");
  mock.restoreAll();
  mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  const unavailable = await GET(apiRequest("GET", session()));
  assert.equal(unavailable.status, 502);
  assert.ok(openSession(unavailable.cookies.get(SESSION_COOKIE)?.value));
});

test("workspace routes protect origin, authentication, JSON, and input length", async () => {
  const mocked = mock.method(globalThis, "fetch", async () => response([]));
  assert.equal((await GET(apiRequest())).status, 401);
  assert.equal(
    (
      await POST(
        apiRequest(
          "POST",
          session(),
          '{"name":"new"}',
          "https://attacker.test",
        ),
      )
    ).status,
    403,
  );
  for (const body of [
    "{",
    "null",
    '{"name":" "}',
    JSON.stringify({ name: "a".repeat(101) }),
  ]) {
    assert.equal((await POST(apiRequest("POST", session(), body))).status, 400);
  }
  assert.equal(mocked.mock.callCount(), 0);
  const result = await GET(apiRequest("GET", session()));
  assert.equal(result.status, 200);
  assert.match(result.headers.get("cache-control")!, /no-store/);
  assert.deepEqual(await result.json(), []);
  assert.ok(
    !JSON.stringify(await GET(apiRequest("GET", session()))).includes(
      "refreshToken",
    ),
  );
});

test("workspace detail validates its ID and preserves access errors", async () => {
  const id = "01234567-89ab-4cde-8f01-23456789abcd";
  const context = (workspaceId: string) => ({ params: Promise.resolve({ workspaceId }) });
  const mocked = mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, `http://backend.test/api/v1/workspaces/${id}`);
    return response({ id, name: "Shared" });
  });
  assert.equal((await getWorkspace(apiRequest(), context(id))).status, 401);
  for (const bad of ["invalid", "../auth/token", "id?other=true", ""]) {
    assert.equal((await getWorkspace(apiRequest("GET", session()), context(bad))).status, 400);
  }
  assert.equal(mocked.mock.callCount(), 0);
  const result = await getWorkspace(apiRequest("GET", session()), context(id));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { id, name: "Shared" });
  mocked.mock.restore();
  mock.method(globalThis, "fetch", async () => new Response(null, { status: 404 }));
  assert.equal((await getWorkspace(apiRequest("GET", session()), context(id))).status, 404);
});

test("workspace deletion uses CSRF, returns an empty 204, and rejects a foreign origin", async () => {
  const id = "01234567-89ab-4cde-8f01-23456789abcd";
  const context = { params: Promise.resolve({ workspaceId: id }) };
  const mocked = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url.endsWith("/auth/csrf")) return response({ headerName: "X-CSRF-TOKEN", token: "csrf" }, "JSESSIONID=s; HttpOnly");
    assert.equal(url, `http://backend.test/api/v1/workspaces/${id}`);
    assert.equal(init.method, "DELETE");
    assert.equal(new Headers(init.headers).get("X-CSRF-TOKEN"), "csrf");
    assert.equal(new Headers(init.headers).get("cookie"), "JSESSIONID=s");
    return new Response(null, { status: 204 });
  });
  assert.equal((await deleteWorkspace(apiRequest("DELETE", session(), undefined, "https://attacker.test"), context)).status, 403);
  assert.equal(mocked.mock.callCount(), 0);
  const result = await deleteWorkspace(apiRequest("DELETE", session()), context);
  assert.equal(result.status, 204);
  assert.equal(await result.text(), "");
  assert.match(result.headers.get("cache-control")!, /no-store/);
});

test("joining validates text codes and distinguishes invalid and already joined responses", async () => {
  const mocked = mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url.endsWith("/auth/csrf")) return response({ headerName: "X-CSRF-TOKEN", token: "csrf" }, "JSESSIONID=s; HttpOnly");
    assert.equal(url, "http://backend.test/api/v1/workspaces/join");
    assert.equal(init.body, '{"code":"0ABC12"}');
    return new Response(null, { status: 409 });
  });
  for (const code of ["abc123", "12345", "<script>", 123456]) {
    assert.equal((await joinWorkspace(apiRequest("POST", session(), JSON.stringify({ code })))).status, 400);
  }
  assert.equal(mocked.mock.callCount(), 0);
  const result = await joinWorkspace(apiRequest("POST", session(), '{"code":"0ABC12"}'));
  assert.equal(result.status, 409);
  assert.match((await result.json()).message, /すでに参加/);
});
