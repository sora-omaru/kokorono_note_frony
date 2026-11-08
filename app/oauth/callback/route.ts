import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "../../../lib/server/backend";
import { privateResponse } from "../../../lib/server/http";
import { cookieOptions, FLOW_COOKIE, sealSession, SESSION_COOKIE } from "../../../lib/server/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const flow = request.nextUrl.searchParams.get("flow");
  const expected = request.cookies.get(FLOW_COOKIE)?.value;
  let response: NextResponse;
  try {
    if (!code || !flow || !expected || !/^[a-f0-9]{64}$/.test(flow) ||
        flow.length !== expected.length || !timingSafeEqual(Buffer.from(flow), Buffer.from(expected))) {
      throw new Error("Invalid login flow");
    }
    const session = await exchangeCode(code);
    response = NextResponse.redirect(new URL("/workspaces", request.url));
    response.cookies.set(SESSION_COOKIE, sealSession(session), cookieOptions());
    response.cookies.set("accessToken", "", cookieOptions(0));
  } catch {
    response = NextResponse.redirect(new URL("/login?error=oauth", request.url));
    response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  }
  response.cookies.set(FLOW_COOKIE, "", cookieOptions(0));
  response.headers.set("Referrer-Policy", "no-referrer");
  return privateResponse(response);
}
