"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { browserApi } from "../../../lib/api";
import { useApiResource } from "../../../lib/use-api-resource";
import type { Workspace } from "../../../lib/workspaces";
import { ErrorState, LoadingState, Screen } from "../../components/ui";
import EntryCollection from "../entry-collection";

export default function WorkspaceDetail({ workspaceId }: { workspaceId: string }) {
  const { data: workspace, error, retry } = useApiResource<Workspace>(`/api/workspaces/${workspaceId}`);
  const router = useRouter();
  const busy = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function remove() {
    if (!workspace || busy.current) return;
    if (!window.confirm(`「${workspace.name}」を削除しますか？\n配下のEvent・Category・Noteと招待コードもすべて削除されます。\nこの操作は取り消せません。`)) return;
    busy.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      await browserApi<void>(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
      router.replace("/workspaces");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "削除に失敗しました。再試行してください。");
    } finally {
      busy.current = false;
      setDeleting(false);
    }
  }

  const missing = error?.status === 404;
  return <Screen title={missing ? "Workspaceが見つかりません" : workspace?.name ?? "Workspace"}
    breadcrumbs={[{ label: "Workspace一覧", href: "/workspaces" }, { label: missing ? "見つかりません" : workspace?.name ?? "詳細" }]}>
    {error ? <>
      <ErrorState message={missing ? "削除されたか、このWorkspaceに参加していない可能性があります。" : error.message} onRetry={missing ? undefined : retry} />
      <Link href="/workspaces" className="btn btn-secondary">Workspace一覧へ戻る</Link>
    </> : !workspace ? <LoadingState /> : <>
      <section className="panel" aria-labelledby="workspace-about">
        <h2 id="workspace-about" className="text-lg font-semibold text-slate-900">このWorkspaceについて</h2>
        <p className="mt-3 leading-7 text-slate-600">旅行やイベントの注意点、持ち物、次回へのメモなどを、参加者と共有するための場所です。参加者はみんな同じように記録を編集できます。</p>
      </section>
      <EntryCollection label="出来事" apiPath={`/api/workspaces/${workspaceId}/events`} hrefBase={`/workspaces/${workspaceId}/events`} />
      <section className="panel border-red-200" aria-labelledby="workspace-delete">
        <h2 id="workspace-delete" className="font-semibold text-slate-900">Workspaceの削除</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">削除すると、配下の出来事（Event）、分類（Category）、メモ（Note）、招待コードもすべて削除されます。参加者全員がアクセスできなくなります。</p>
        {deleteError && <p role="alert" className="mt-4 leading-7 text-red-800">{deleteError}</p>}
        <button type="button" className="btn btn-danger mt-5" disabled={deleting} onClick={remove}>
          {deleting ? "削除中…" : "このWorkspaceを削除"}
        </button>
      </section>
    </>}
  </Screen>;
}
