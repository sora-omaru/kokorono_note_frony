"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { browserApi } from "../../lib/api";
import { isWorkspaceId, type Workspace } from "../../lib/workspaces";
import { Screen } from "../components/ui";

export default function WorkspaceForm({ mode }: { mode: "create" | "join" }) {
  const joining = mode === "join";
  const title = joining ? "招待コードで参加" : "新しいWorkspaceを作成";
  const router = useRouter();
  const busy = useRef(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const normalized = value.trim();
    if (joining ? !/^[A-Z0-9]{6}$/.test(normalized) : !normalized || value.length > 100) {
      setError(joining ? "英大文字と数字6文字の招待コードを入力してください。" : "Workspace名を1〜100文字で入力してください。");
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const workspace = await browserApi<Workspace>(joining ? "/api/workspaces/join" : "/api/workspaces", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(joining ? { code: normalized } : { name: normalized }),
      });
      if (!isWorkspaceId(workspace.id)) throw new Error("保存先を確認できませんでした。Workspace一覧を確認してください。");
      setValue("");
      router.replace(`/workspaces/${workspace.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "操作に失敗しました。再試行してください。");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <Screen title={title}
    description={joining ? "招待した方から受け取った6文字のコードを入力してください。" : "家族や友人と記録をまとめる場所に、名前をつけましょう。"}
    breadcrumbs={[{ label: "Workspace一覧", href: "/workspaces" }, { label: title }]}>
    <form onSubmit={submit} className="panel space-y-6" aria-busy={pending}>
      <div>
        <label htmlFor="workspace-value" className="block font-medium text-slate-900">{joining ? "招待コード" : "Workspace名"}</label>
        <p id="workspace-help" className="mt-2 text-sm leading-6 text-slate-600">
          {joining ? "英大文字と数字の6文字。有効期限は発行から30分です。" : "100文字以内で入力してください。例：家族の心のノート"}
        </p>
        <input id="workspace-value" name={joining ? "code" : "name"} type="text" className="field mt-3"
          required maxLength={joining ? 6 : 100} minLength={joining ? 6 : 1}
          autoComplete="off" autoCapitalize={joining ? "characters" : "off"} spellCheck={!joining}
          pattern={joining ? "[A-Z0-9]{6}" : undefined}
          aria-describedby={error ? "workspace-help workspace-error" : "workspace-help"} aria-invalid={!!error}
          disabled={pending} value={value}
          onChange={(event) => { setValue(joining ? event.target.value.toUpperCase() : event.target.value); setError(""); }} />
        {!joining && <p className="mt-2 text-right text-sm text-slate-500">{value.length} / 100文字</p>}
      </div>
      {error && <p id="workspace-error" role="alert" className="leading-7 text-red-800">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "送信中…" : joining ? "参加する" : "作成する"}</button>
        {pending ? <span className="text-sm text-slate-500" role="status">処理が終わるまでお待ちください</span> :
          <Link href="/workspaces" className="btn btn-secondary">キャンセル</Link>}
      </div>
    </form>
  </Screen>;
}
