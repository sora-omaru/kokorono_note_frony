import { NextRequest, NextResponse } from "next/server";
import { ApiError, type Workspace } from "../../../lib/server/backend";
import { withBackend } from "../../../lib/server/http";

export async function GET(request: NextRequest) {
  return withBackend(request, async (api) =>
    NextResponse.json(await api.call<Workspace[]>("/api/v1/workspaces")));
}

export async function POST(request: NextRequest) {
  return withBackend(request, async (api) => {
    let data;
    try { data = await request.json(); }
    catch { throw new ApiError(400, "入力内容を確認してください"); }
    if (typeof data?.name !== "string" || !data.name.trim() || data.name.length > 100) {
      throw new ApiError(400, "Workspace名を1〜100文字で入力してください");
    }
    const workspace = await api.call<Workspace>("/api/v1/workspaces", {
      method: "POST", body: { name: data.name.trim() },
    });
    return NextResponse.json(workspace, { status: 201 });
  });
}
