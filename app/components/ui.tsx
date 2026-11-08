import Link from "next/link";
import type { ReactNode } from "react";

type Crumb = { label: string; href?: string };

export function Screen({ title, description, breadcrumbs = [], children }: {
  title: string; description?: string; breadcrumbs?: Crumb[]; children: ReactNode;
}) {
  return <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
    {breadcrumbs.length > 0 && <nav aria-label="現在の位置" className="mb-6 text-sm text-slate-600">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {breadcrumbs.map((crumb, index) => <li key={index} className="flex min-w-0 items-center gap-2">
          {index > 0 && <span aria-hidden="true" className="text-slate-400">/</span>}
          {crumb.href ? <Link href={crumb.href} className="rounded hover:text-slate-950 hover:underline">{crumb.label}</Link> :
            <span aria-current="page" className="break-words text-slate-800">{crumb.label}</span>}
        </li>)}
      </ol>
    </nav>}
    <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
    {description && <p className="mt-3 leading-7 text-slate-600">{description}</p>}
    <div className="mt-8 space-y-6">{children}</div>
  </main>;
}

export function LoadingState() {
  return <p role="status" className="panel text-slate-600">読み込み中…</p>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="panel border-red-200">
    <p className="leading-7 text-red-800">{message}</p>
    {onRetry && <button type="button" className="btn btn-secondary mt-4" onClick={onRetry}>再試行</button>}
  </div>;
}

export function WorkspaceActions() {
  return <div className="flex flex-wrap gap-3">
    <Link href="/workspaces/new" className="btn btn-primary">新しいWorkspaceを作成</Link>
    <Link href="/workspaces/join" className="btn btn-secondary">招待コードで参加</Link>
  </div>;
}
