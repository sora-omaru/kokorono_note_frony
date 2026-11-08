"use client";

import { useState } from "react";
import { browserApi, type WorkspaceApiPath } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import type { CategoryItem } from "../../lib/entries";
import { ErrorState, LoadingState } from "../components/ui";
import { DeleteEntry, EntryForm, RenameEntry } from "./entry-controls";
import NoteList from "./note-list";

function CategoryRow({ category, apiPath, eventHref, onRenamed, onDeleted }: {
  category: CategoryItem; apiPath: WorkspaceApiPath; eventHref: string;
  onRenamed: (name: string) => void; onDeleted: () => void;
}) {
  const [visited, setVisited] = useState(false);
  return <details className="panel" onToggle={(event) => {
    if (event.currentTarget.open) setVisited(true);
  }}>
    <summary className="cursor-pointer break-words font-semibold leading-7 text-slate-900">{category.name}</summary>
    {visited && <div className="mt-6 space-y-6">
      <NoteList apiPath={`${apiPath}/notes`} />
      <RenameEntry apiPath={apiPath} label="分類" name={category.name} onSaved={onRenamed} />
      <DeleteEntry apiPath={apiPath} label="分類" name={category.name} parentHref={eventHref}
        childrenLabel="メモ" onDeleted={onDeleted} />
    </div>}
  </details>;
}

export default function CategoryList({ apiPath, eventHref }: { apiPath: WorkspaceApiPath; eventHref: string }) {
  const { data: categories, error, refresh, setData } = useApiResource<CategoryItem[]>(apiPath);
  return <section className="space-y-4" aria-label="分類の一覧と追加">
    <h2 className="text-xl font-semibold text-slate-900">分類の一覧</h2>
    {error && <ErrorState message={error.message} onRetry={refresh} />}
    {!categories ? !error && <LoadingState /> : categories.length === 0 ?
      <p className="panel leading-7 text-slate-600">まだ分類がありません。下のフォームから追加しましょう。</p> :
      <ul className="space-y-3">{categories.map((category) => <li key={category.id}>
        <CategoryRow category={category} apiPath={`${apiPath}/${category.id}`} eventHref={eventHref}
          onRenamed={(name) => setData((current) => current?.map((item) => item.id === category.id ? { ...item, name } : item) ?? null)}
          onDeleted={() => setData((current) => current?.filter((item) => item.id !== category.id) ?? null)} />
      </li>)}</ul>}
    {error?.status !== 404 && <div className="panel">
      <h3 className="mb-5 font-semibold text-slate-900">分類を追加</h3>
      <EntryForm label="分類の名前" submitLabel="追加する" resetAfterSave onSubmit={async (name) => {
        const created = await browserApi<CategoryItem>(apiPath, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
        });
        setData((current) => [...(current ?? []).filter((category) => category.id !== created.id), created]);
        refresh();
      }} />
    </div>}
  </section>;
}
