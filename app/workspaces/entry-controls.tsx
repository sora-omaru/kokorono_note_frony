"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { browserApi, type WorkspaceApiPath } from "../../lib/api";

export function EntryForm({ label, initialValue = "", multiline = false, submitLabel,
  resetAfterSave = false, onSubmit, onCancel }: {
  label: string; initialValue?: string; multiline?: boolean; submitLabel: string;
  resetAfterSave?: boolean; onSubmit: (value: string) => Promise<void>; onCancel?: () => void;
}) {
  const id = useId();
  const limit = multiline ? 255 : 100;
  const busy = useRef(false);
  const [draft, setDraft] = useState({ initialValue, value: initialValue });
  // 未編集なら再取得した最新値を使い、編集中なら利用者の下書きを維持する。
  const value = draft.value === draft.initialValue ? initialValue : draft.value;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!value.trim() || value.length > limit) {
      setError(`${label}を1〜${limit}文字で入力してください。`);
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    setSaved(false);
    try {
      await onSubmit(value.trim());
      const savedValue = resetAfterSave ? "" : value.trim();
      setDraft({ initialValue: savedValue, value: savedValue });
      setSaved(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存に失敗しました。再試行してください。");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  const field = {
    id, name: multiline ? "content" : "name", className: "field mt-2", value,
    required: true, maxLength: limit, disabled: pending,
    "aria-describedby": error ? `${id}-help ${id}-error` : `${id}-help`,
    "aria-invalid": !!error,
    onChange: (event: { target: { value: string } }) => { setDraft({ initialValue, value: event.target.value }); setError(""); setSaved(false); },
  };
  return <form onSubmit={submit} aria-busy={pending} className="space-y-4">
    <div>
      <label htmlFor={id} className="block font-medium text-slate-900">{label}</label>
      {multiline ? <textarea {...field} rows={4} /> : <input {...field} type="text" autoComplete="off" />}
      <p id={`${id}-help`} className="mt-2 text-right text-sm text-slate-500">{value.length} / {limit}文字</p>
    </div>
    {error && <p id={`${id}-error`} role="alert" className="leading-7 text-red-800">{error}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "保存中…" : submitLabel}</button>
      {onCancel && <button type="button" className="btn btn-secondary" disabled={pending} onClick={onCancel}>キャンセル</button>}
      {saved && <span role="status" className="text-sm text-slate-600">保存しました</span>}
    </div>
  </form>;
}

export function RenameEntry({ apiPath, label, name, onSaved }: {
  apiPath: WorkspaceApiPath; label: string; name: string; onSaved: (name: string) => void;
}) {
  return <details className="panel">
    <summary className="cursor-pointer font-semibold text-slate-900">名前を変更</summary>
    <div className="mt-5"><EntryForm label={`${label}の名前`} initialValue={name} submitLabel="名前を保存"
      onSubmit={async (value) => {
        const result = await browserApi<{ name: string }>(apiPath, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: value }),
        });
        onSaved(result.name);
      }} /></div>
  </details>;
}

export function DeleteEntry({ apiPath, label, name, parentHref, childrenLabel, onDeleted }: {
  apiPath: WorkspaceApiPath; label: string; name: string; parentHref: string; childrenLabel: string; onDeleted?: () => void;
}) {
  const router = useRouter();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (busy.current || !window.confirm(`「${name}」を削除しますか？\n配下の${childrenLabel}もすべて削除されます。\nこの操作は取り消せません。`)) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await browserApi<void>(apiPath, { method: "DELETE" });
      if (onDeleted) onDeleted();
      else router.replace(parentHref);
    } catch (error) {
      setError(error instanceof Error ? error.message : "削除に失敗しました。再試行してください。");
    } finally { busy.current = false; setPending(false); }
  }
  return <section className="panel border-red-200" aria-label={`${label}の削除`}>
    <h2 className="font-semibold text-slate-900">{label}の削除</h2>
    <p className="mt-3 text-sm leading-7 text-slate-600">この{label}と、配下の{childrenLabel}をすべて削除します。取り消すことはできません。</p>
    {error && <p role="alert" className="mt-4 text-red-800">{error}</p>}
    <button type="button" className="btn btn-danger mt-5" disabled={pending} onClick={remove}>{pending ? "削除中…" : `この${label}を削除`}</button>
  </section>;
}
