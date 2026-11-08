"use client";

import Link from "next/link";
import { useApiResource } from "../../lib/use-api-resource";
import type { Workspace } from "../../lib/workspaces";
import { ErrorState, LoadingState, Screen, WorkspaceActions } from "../components/ui";

export default function WorkspaceList() {
  const { data: workspaces, error, retry } = useApiResource<Workspace[]>("/api/workspaces");
  return <Screen title="参加しているWorkspace" description="大切なことを、ひとりでも、みんなでも。記録をまとめる場所を選びましょう。">
    <WorkspaceActions />
    {error ? <ErrorState message={error.message} onRetry={retry} /> : workspaces === null ? <LoadingState /> :
      workspaces.length === 0 ? <section className="panel py-10 text-center">
        <h2 className="text-lg font-semibold text-slate-900">まだWorkspaceがありません</h2>
        <p className="mt-3 leading-7 text-slate-600">新しく作成するか、招待コードで参加して記録を始めましょう。</p>
      </section> : <ul className="space-y-3">{workspaces.map((workspace) =>
        <li key={workspace.id} className="panel flex flex-wrap items-center justify-between gap-3">
          <Link href={`/workspaces/${workspace.id}`} className="min-w-0 break-words font-semibold text-slate-900 hover:underline">{workspace.name} →</Link>
          <Link href={`/workspaces/${workspace.id}/invites`} className="btn btn-secondary">招待コードを発行</Link>
        </li>)}
      </ul>}
  </Screen>;
}
