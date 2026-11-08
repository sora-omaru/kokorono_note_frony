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
        <li key={workspace.id}>
          <Link href={`/workspaces/${workspace.id}`} className="panel flex items-center justify-between gap-4 transition-colors hover:border-slate-400 hover:bg-slate-100">
            <span className="min-w-0 break-words font-semibold text-slate-900">{workspace.name}</span>
            <span aria-hidden="true" className="shrink-0 text-slate-500">→</span>
          </Link>
        </li>)}
      </ul>}
  </Screen>;
}
