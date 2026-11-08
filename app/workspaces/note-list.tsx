"use client";

import { useRef, useState } from "react";
import { browserApi, type WorkspaceApiPath } from "../../lib/api";
import { useApiResource } from "../../lib/use-api-resource";
import type { NoteItem } from "../../lib/entries";
import { ErrorState, LoadingState } from "../components/ui";
import { EntryForm } from "./entry-controls";

function NoteRow({ note, index, apiPath, onSaved, onDeleted }: {
  note: NoteItem; index: number; apiPath: WorkspaceApiPath;
  onSaved: (note: NoteItem) => void; onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  async function remove() {
    if (busy.current || !window.confirm("このメモを削除しますか？\nこの操作は取り消せません。")) return;
    busy.current = true;
    setDeleting(true);
    setError("");
    try { await browserApi<void>(apiPath, { method: "DELETE" }); onDeleted(); }
    catch (error) { setError(error instanceof Error ? error.message : "削除に失敗しました。"); }
    finally { busy.current = false; setDeleting(false); }
  }
  return <article className="panel" aria-label={`メモ ${index + 1}`}>
    {editing ? <EntryForm label="メモの本文" multiline initialValue={note.content} submitLabel="メモを保存"
      onCancel={() => setEditing(false)} onSubmit={async (content) => {
        const updated = await browserApi<NoteItem>(apiPath, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }),
        });
        onSaved(updated);
        setEditing(false);
      }} /> : <>
      <p className="whitespace-pre-wrap break-words leading-7 text-slate-800">{note.content}</p>
      {error && <p role="alert" className="mt-4 text-red-800">{error}</p>}
      <div className="mt-5 flex gap-3">
        <button type="button" className="btn btn-secondary" disabled={deleting} onClick={() => { setEditing(true); setError(""); }}>編集</button>
        <button type="button" className="btn btn-secondary text-red-800" disabled={deleting} onClick={remove}>{deleting ? "削除中…" : "削除"}</button>
      </div>
    </>}
  </article>;
}

export default function NoteList({ apiPath }: { apiPath: WorkspaceApiPath }) {
  const { data: notes, error, refresh, setData } = useApiResource<NoteItem[]>(apiPath);
  return <section className="space-y-4" aria-label="メモの一覧と追加">
    <h2 className="text-xl font-semibold text-slate-900">メモの一覧</h2>
    <p className="text-sm leading-6 text-slate-600">追加した順に表示します。編集しても順番は変わりません。</p>
    {error && <ErrorState message={error.message} onRetry={refresh} />}
    {!notes ? !error && <LoadingState /> :
      notes.length === 0 ? <p className="panel leading-7 text-slate-600">まだメモがありません。次に活かしたいことを書き留めましょう。</p> :
        <div className="space-y-3">{notes.map((note, index) => <NoteRow key={note.id} note={note} index={index}
          apiPath={`${apiPath}/${note.id}`} onSaved={(updated) => setData((current) => current?.map((item) => item.id === updated.id ? updated : item) ?? null)}
          onDeleted={() => setData((current) => current?.filter((item) => item.id !== note.id) ?? null)} />)}</div>}
    {error?.status !== 404 && <div className="panel">
      <h3 className="mb-5 font-semibold text-slate-900">メモを追加</h3>
      <EntryForm label="新しいメモの本文" multiline submitLabel="追加する" resetAfterSave onSubmit={async (content) => {
        const created = await browserApi<NoteItem>(apiPath, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
        setData((current) => [...(current ?? []).filter((note) => note.id !== created.id), created]);
        // 行をunmountせず、ほかのメモの編集中の下書きを残して一覧を再取得する。
        refresh();
      }} />
    </div>}
  </section>;
}
