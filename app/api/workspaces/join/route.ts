import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "../../../../lib/server/backend";
import { withBackend } from "../../../../lib/server/http";
import type { Workspace } from "../../../../lib/workspaces";

export async function POST(request: NextRequest) {
  return withBackend(request, async (api) => {
    let data;
    try { data = await request.json(); }
    catch { throw new ApiError(400, "招待コードを確認してください"); }
    if (typeof data?.code !== "string" || !/^[A-Z0-9]{6}$/.test(data.code)) {
      throw new ApiError(400, "英大文字と数字6文字の招待コードを入力してください");
    }
    try {
      return NextResponse.json(await api.call<Workspace>("/api/v1/workspaces/join", {
        method: "POST", body: { code: data.code },
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        throw new ApiError(400, "招待コードが無効、または期限切れです。招待した方に確認してください。");
      }
      if (error instanceof ApiError && error.status === 409) {
        throw new ApiError(409, "このWorkspaceにはすでに参加しています。一覧を確認してください。");
      }
      throw error;
    }
  });
}
