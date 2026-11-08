"use client";

import { useRef, useState } from "react";
import { browserApi } from "../../lib/api";

type Invite = { code: string; expiresAt: string };

export default function InviteIssuer({ workspaceId }: { workspaceId: string }) {
  const busy = useRef(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function issue() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      // 再発行時も同じAPIを呼び、成功した新しいコードだけを画面に表示する。
      const created = await browserApi<Invite>(
        `/api/workspaces/${workspaceId}/invites`,
        { method: "POST" },
      );
      setInvite(created);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "招待コードを発行できませんでした。再試行してください。",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <section className="panel space-y-4" aria-labelledby="workspace-invite">
      <h2
        id="workspace-invite"
        className="text-lg font-semibold text-slate-900"
      >
        招待コード
      </h2>
      <p className="text-sm leading-7 text-slate-600">
        コードは発行から30分間、複数人が利用できます。発行・再発行すると以前のコードは使えなくなります。
      </p>
      {invite && (
        <div
          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
          role="status"
        >
          <p className="text-sm text-slate-600">
            参加する方にこの6文字を伝えてください
          </p>
          <p className="mt-2 select-all break-all font-mono text-3xl font-bold tracking-widest text-slate-900">
            {invite.code}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            有効期限：
            <time dateTime={invite.expiresAt}>
              {new Intl.DateTimeFormat("ja-JP", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(invite.expiresAt))}
            </time>
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-800">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={issue}
      >
        {pending
          ? "発行中…"
          : invite
            ? "招待コードを再発行"
            : "招待コードを発行・再発行"}
      </button>
    </section>
  );
}
