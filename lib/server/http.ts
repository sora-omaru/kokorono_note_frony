import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ApiError, BackendClient } from "./backend";
import {
  cookieOptions,
  openSession,
  sealSession,
  SESSION_COOKIE,
} from "./session";

export function privateResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

export function saveSession(response: NextResponse, client: BackendClient) {
  response.cookies.set(
    SESSION_COOKIE,
    sealSession(client.session),
    cookieOptions(
      Math.max(0, Math.floor((client.session.expiresAt - Date.now()) / 1000)),
    ),
  );
  return privateResponse(response);
}

export async function withBackend(
  request: NextRequest,
  action: (client: BackendClient) => Promise<NextResponse>,
) {
  let client: BackendClient | undefined;
  try {
    if (
      request.method !== "GET" &&
      request.headers.get("origin") !== request.nextUrl.origin
    ) {
      throw new ApiError(403, "この画面から操作をやり直してください");
    }
    const session = openSession(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) throw new ApiError(401, "ログインしてください");
    client = new BackendClient(session);
    return saveSession(await action(client), client);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 503;
    const response = privateResponse(
      NextResponse.json(
        {
          message:
            error instanceof ApiError
              ? error.message
              : "認証設定を確認してください",
        },
        { status },
      ),
    );
    if (status === 401) {
      response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
      response.cookies.set("accessToken", "", cookieOptions(0));
    } else if (client) {
      // refresh後に入力エラー等が起きても、新しいCookieを失わない。
      return saveSession(response, client);
    }
    return response;
  }
}
