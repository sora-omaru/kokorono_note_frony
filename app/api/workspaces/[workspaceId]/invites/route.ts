import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "../../../../../lib/server/backend";
import { withBackend } from "../../../../../lib/server/http";
import { isWorkspaceId } from "../../../../../lib/workspaces";

type Context = { params: Promise<{ workspaceId: string }> };
type Invite = { code: string; expiresAt: string };

export async function POST(request: NextRequest, { params }: Context) {
  return withBackend(request, async (api) => {
    const { workspaceId } = await params;
    if (!isWorkspaceId(workspaceId))
      throw new ApiError(400, "WorkspaceのURLが不正です");

    // 発行・再発行と所属確認はAPI側に任せ、ブラウザーへはコードと期限だけを返す。
    const invite = await api.call<Invite>(
      `/api/v1/workspaces/${workspaceId}/invites`,
      { method: "POST" },
    );
    if (
      !/^[A-Z0-9]{6}$/.test(invite?.code) ||
      typeof invite.expiresAt !== "string" ||
      Number.isNaN(Date.parse(invite.expiresAt))
    ) {
      throw new ApiError(502, "招待コードの応答が不正です");
    }
    return NextResponse.json(invite, { status: 201 });
  });
}
