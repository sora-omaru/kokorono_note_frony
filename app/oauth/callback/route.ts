import { NextRequest, NextResponse } from "next/server";

type TokenResponse = {
  accessToken: string;
};

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return new Response("認証コードがありません", {
      status: 400,
    });
  }

  const apiBaseUrl = process.env.API_BASE_URL;

  if (!apiBaseUrl) {
    return (
      new Response("APIの接続先が未設定です"),
      {
        status: 500,
      }
    );
  }

  try {
    const result = await fetch(`${apiBaseUrl}/auth/token`, {
      method: "POST",
      headers: {
        "Content Type": "application/json",
      },
      body: JSON.stringify({ code }),
      cache: "no-store",
    });

    if (!result.ok) {
      return new Response("トークンの取得に失敗しました", {
        status: 502,
      });
    }
    const data: TokenResponse = await result.json();

    if (!data.accessToken) {
      return new Response("JWTが返却されませんでした", {
        status: 502,
      });
    }

    const response = NextResponse.redirect(new URL("/workspace", request.url));

    response.cookies.set("accsessToken", data.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch {
    return new Response("認証処理でエラーが発生しました。", {
      status: 502,
    });
  }
}
