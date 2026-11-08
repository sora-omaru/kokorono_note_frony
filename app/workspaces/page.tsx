import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { openSession, SESSION_COOKIE } from "../../lib/server/session";
import WorkspaceList from "./workspace-list";

async function ProtectedWorkspaces() {
  const store = await cookies();
  if (!openSession(store.get(SESSION_COOKIE)?.value)) redirect("/login");
  return <WorkspaceList />;
}

export default function WorkspacesPage() {
  return <Suspense fallback={<p className="p-6">読み込み中…</p>}>
    <ProtectedWorkspaces />
  </Suspense>;
}
