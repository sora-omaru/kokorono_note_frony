import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "../../../../lib/server/backend";
import { withBackend } from "../../../../lib/server/http";
import { isWorkspaceId, type Workspace } from "../../../../lib/workspaces";

type Context = { params: Promise<{ workspaceId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  return withBackend(request, async (api) => {
    const { workspaceId } = await params;
    if (!isWorkspaceId(workspaceId)) throw new ApiError(400, "WorkspaceのURLが不正です");
    return NextResponse.json(await api.call<Workspace>(`/api/v1/workspaces/${workspaceId}`));
  });
}

export async function DELETE(request: NextRequest, { params }: Context) {
  return withBackend(request, async (api) => {
    const { workspaceId } = await params;
    if (!isWorkspaceId(workspaceId)) throw new ApiError(400, "WorkspaceのURLが不正です");
    await api.call<void>(`/api/v1/workspaces/${workspaceId}`, { method: "DELETE" });
    return new NextResponse(null, { status: 204 });
  });
}
