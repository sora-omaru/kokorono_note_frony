import { NextRequest, NextResponse } from "next/server";
import { isEntryId, type CategoryItem, type EventItem, type NoteItem } from "../../../../../../lib/entries";
import { ApiError } from "../../../../../../lib/server/backend";
import { withBackend } from "../../../../../../lib/server/http";
import { isWorkspaceId } from "../../../../../../lib/workspaces";

type Context = { params: Promise<{ workspaceId: string; segments?: string[] }> };
type Target = { collection: boolean; field: "name" | "content"; limit: number };

function targetFor(segments: string[]): Target {
  // この6形以外は中継しない。任意パスを受け付けるプロキシにはしない。
  const shape = segments.length;
  if (shape > 5 || (shape >= 2 && segments[1] !== "categories") ||
      (shape >= 4 && segments[3] !== "notes")) {
    throw new ApiError(404, "対象のページが見つかりません");
  }
  for (const index of [0, 2, 4]) {
    if (index < shape && !isEntryId(segments[index])) {
      throw new ApiError(400, "記録のURLが不正です");
    }
  }
  return { collection: shape % 2 === 0, field: shape >= 4 ? "content" : "name", limit: shape >= 4 ? 255 : 100 };
}

function entry(data: unknown, field: Target["field"]): EventItem | CategoryItem | NoteItem {
  if (typeof data !== "object" || data === null) throw new ApiError(502, "APIの応答が不正です");
  const record = data as Record<string, unknown>;
  if (typeof record.id !== "string" || !isEntryId(record.id) || typeof record[field] !== "string") {
    throw new ApiError(502, "APIの応答が不正です");
  }
  return field === "content" ? { id: record.id, content: record.content as string } : { id: record.id, name: record.name as string };
}

async function handle(request: NextRequest, { params }: Context) {
  return withBackend(request, async (api) => {
    const { workspaceId, segments = [] } = await params;
    if (!isWorkspaceId(workspaceId)) throw new ApiError(400, "WorkspaceのURLが不正です");
    const target = targetFor(segments);
    const methods = target.collection ? ["GET", "POST"] : ["GET", "PATCH", "DELETE"];
    if (!methods.includes(request.method)) {
      return NextResponse.json({ message: "このURLではその操作を実行できません" }, {
        status: 405, headers: { Allow: methods.join(", ") },
      });
    }
    const path = `/api/v1/workspaces/${workspaceId}/events${segments.length ? `/${segments.join("/")}` : ""}`;
    const method = request.method;
    let body: Record<string, string> | undefined;
    if (method === "POST" || method === "PATCH") {
      let data;
      try { data = await request.json(); }
      catch { throw new ApiError(400, "入力内容を確認してください"); }
      const value = data?.[target.field];
      if (typeof value !== "string" || !value.trim() || value.length > target.limit) {
        throw new ApiError(400, `${target.field === "name" ? "名称" : "メモ本文"}を1〜${target.limit}文字で入力してください`);
      }
      body = { [target.field]: value.trim() };
    }
    const result = await api.call<unknown>(path, { method, body });
    if (method === "DELETE") return new NextResponse(null, { status: 204 });
    if (method === "GET" && target.collection) {
      if (!Array.isArray(result)) throw new ApiError(502, "APIの応答が不正です");
      return NextResponse.json(result.map((item) => entry(item, target.field)));
    }
    return NextResponse.json(entry(result, target.field), { status: method === "POST" ? 201 : 200 });
  });
}

export async function GET(request: NextRequest, context: Context) { return handle(request, context); }
export async function POST(request: NextRequest, context: Context) { return handle(request, context); }
export async function PATCH(request: NextRequest, context: Context) { return handle(request, context); }
export async function DELETE(request: NextRequest, context: Context) { return handle(request, context); }
