import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { backendUrl } from "../../../lib/server/backend";
import { cookieOptions, FLOW_COOKIE } from "../../../lib/server/session";
import { privateResponse } from "../../../lib/server/http";

export async function GET(request: Request) {
  try {
    const flow = randomBytes(32).toString("hex");
    const url = new URL(backendUrl("/oauth2/authorization/google"));
    url.searchParams.set("flow", flow);
    const response = NextResponse.redirect(url);
    response.cookies.set(FLOW_COOKIE, flow, cookieOptions(600));
    return privateResponse(response);
  } catch {
    return privateResponse(NextResponse.redirect(new URL("/login?error=config", request.url)));
  }
}
