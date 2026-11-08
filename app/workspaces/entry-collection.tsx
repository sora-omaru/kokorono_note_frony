"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserApi, type WorkspaceApiPath } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import { isEntryId, type EventItem } from "../../lib/entries";
import { ErrorState, LoadingState } from "../components/ui";
import { EntryForm } from "./entry-controls";

export default function EntryCollection({ apiPath, hrefBase, label }: {
  apiPath: WorkspaceApiPath; hrefBase: string; label: string;
}) {
  const { data: entries, error, retry } = useApiResource<EventItem[]>(apiPath);
  const router = useRouter();
  return <section className="space-y-4" aria-label={`${label}の一覧と追加`}>
    <h2 className="text-xl font-semibold text-slate-900">{label}の一覧</h2>
    {error ? <ErrorState message={error.message} onRetry={retry} /> : !entries ? <LoadingState /> :
      entries.length === 0 ? <p className="panel leading-7 text-slate-600">まだ{label}がありません。下のフォームから追加しましょう。</p> :
        <ul className="space-y-3">{entries.map((entry) => <li key={entry.id}>
          <Link href={`${hrefBase}/${entry.id}`} className="panel flex items-center justify-between gap-4 transition-colors hover:border-slate-400 hover:bg-slate-100">
            <span className="min-w-0 break-words font-semibold text-slate-900">{entry.name}</span>
            <span aria-hidden="true" className="shrink-0 text-slate-500">→</span>
          </Link>
        </li>)}</ul>}
    {error?.status !== 404 && <div className="panel">
      <h3 className="mb-5 font-semibold text-slate-900">{label}を追加</h3>
      <EntryForm label={`${label}の名前`} submitLabel="追加する" resetAfterSave onSubmit={async (name) => {
        const entry = await browserApi<EventItem>(apiPath, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
        });
        if (!isEntryId(entry.id)) throw new Error("保存先を確認できませんでした。画面を更新してください。");
        router.push(`${hrefBase}/${entry.id}`);
      }} />
    </div>}
  </section>;
}
