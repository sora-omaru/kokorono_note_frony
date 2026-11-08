import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { openSession, SESSION_COOKIE } from "../../lib/server/session";
import WorkspaceList from "./workspace-list";

async function ProtectedWorkspaces() {
  // セッションの有効期限は事前レンダリング時ではなく、実リクエスト時に判定する。
  await connection();
  const store = await cookies();
  if (!openSession(store.get(SESSION_COOKIE)?.value)) redirect("/login");
  return <WorkspaceList />;
}

export default function WorkspacesPage() {
  return <Suspense fallback={<p className="p-6">読み込み中…</p>}>
    <ProtectedWorkspaces />
  </Suspense>;
}
