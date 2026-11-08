import "server-only";
import { createHash } from "node:crypto";
import { SESSION_SECONDS, type Session } from "./session";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Workspace = { id: string; name: string };

export function backendUrl(path: string): string {
  const base = process.env.API_BASE_URL;
  if (!base) throw new ApiError(503, "APIの接続先が設定されていません");
  const url = new URL(base);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new ApiError(503, "APIの接続先が不正です");
  }
  return `${base.replace(/\/$/, "")}${path}`;
}

async function request(path: string, init: RequestInit = {}) {
  try {
    return await fetch(backendUrl(path), {
      ...init,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      502,
      "APIに接続できません。時間をおいて再試行してください",
    );
  }
}

function cookieFrom(response: Response, name: string): string | undefined {
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";", 1)[0];
    if (pair.startsWith(`${name}=`)) {
      const value = pair.slice(name.length + 1);
      if (!value || /[\s;,\r\n]/.test(value)) return;
      return value;
    }
  }
}

function statusError(status: number): ApiError {
  const messages: Record<number, string> = {
    400: "入力内容を確認してください",
    401: "ログインの有効期限が切れました。再度ログインしてください",
    403: "この操作を実行できません。画面を更新して再試行してください",
    404: "対象のデータが見つかりません",
    409: "データの状態が変わっています。画面を更新してください",
  };
  return new ApiError(
    status >= 400 && status < 500 ? status : 502,
    messages[status] ??
      "APIでエラーが発生しました。時間をおいて再試行してください",
  );
}

async function json<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(502, "APIの応答が不正です");
  }
}

async function receiveTokens(
  response: Response,
  backendSession?: string,
): Promise<Session> {
  if (!response.ok) throw statusError(response.status);
  const data = await json<{ accessToken: string }>(response);
  const refreshToken = cookieFrom(response, "refreshToken");
  if (
    typeof data.accessToken !== "string" ||
    !data.accessToken ||
    !refreshToken
  ) {
    throw new ApiError(502, "認証情報を取得できませんでした");
  }
  return {
    accessToken: data.accessToken,
    refreshToken,
    backendSession,
    expiresAt: Date.now() + SESSION_SECONDS * 1000,
  };
}

export async function exchangeCode(code: string): Promise<Session> {
  return receiveTokens(
    await request("/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }),
  );
}

async function csrf(session: Session) {
  const response = await request("/auth/csrf", {
    headers: session.backendSession
      ? { Cookie: `JSESSIONID=${session.backendSession}` }
      : {},
  });
  if (!response.ok) throw statusError(response.status);
  session.backendSession =
    cookieFrom(response, "JSESSIONID") ?? session.backendSession;
  const data = await json<{ headerName: string; token: string }>(response);
  if (
    data.headerName !== "X-CSRF-TOKEN" ||
    typeof data.token !== "string" ||
    !data.token ||
    !session.backendSession
  ) {
    throw new ApiError(502, "CSRF情報を取得できませんでした");
  }
  return { [data.headerName]: data.token };
}

// 生トークンをキーにせず、同一プロセスの更新をまとめる。遅れて到着する古いCookieにも10秒対応する。
const refreshes = new Map<
  string,
  { promise: Promise<Session>; until: number }
>();
async function refresh(session: Session): Promise<Session> {
  const now = Date.now();
  for (const [key, value] of refreshes)
    if (value.until < now) refreshes.delete(key);
  const key = createHash("sha256").update(session.refreshToken).digest("hex");
  const existing = refreshes.get(key);
  if (existing) return { ...(await existing.promise) };
  const promise = (async () => {
    const headers = await csrf(session);
    return receiveTokens(
      await request("/auth/refresh", {
        method: "POST",
        headers: {
          ...headers,
          Cookie: `JSESSIONID=${session.backendSession}; refreshToken=${session.refreshToken}`,
        },
      }),
      session.backendSession,
    );
  })();
  refreshes.set(key, { promise, until: now + 60000 });
  try {
    const result = await promise;
    refreshes.set(key, {
      promise: Promise.resolve(result),
      until: Date.now() + 10000,
    });
    return { ...result };
  } catch (error) {
    refreshes.delete(key);
    throw error;
  }
}

/** Route Handler / Server Action専用。Cookie保存までを呼び出し元で必ず行う。 */
export class BackendClient {
  constructor(public session: Session) {
    this.session = { ...session };
  }

  // ブラウザーから任意パスを受け取らず、サーバーのコード内で固定して使う。
  async call<T>(
    path: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    if (
      !path.startsWith("/api/v1/") ||
      path.includes("..") ||
      /[?#]/.test(path)
    ) {
      throw new ApiError(400, "APIのパスが不正です");
    }
    const method = init.method ?? "GET";
    const send = async () => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.session.accessToken}`,
      };
      if (method !== "GET") {
        Object.assign(headers, await csrf(this.session));
        headers.Cookie = `JSESSIONID=${this.session.backendSession}`;
      }
      if (init.body !== undefined) headers["Content-Type"] = "application/json";
      return request(path, {
        method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    };
    let response = await send();
    if (response.status === 401) {
      this.session = await refresh(this.session);
      response = await send();
    }
    if (!response.ok) throw statusError(response.status);
    if (response.status === 204) return undefined as T;
    return json<T>(response);
  }
}
