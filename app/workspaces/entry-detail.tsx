"use client";

import Link from "next/link";
import { useApiResource } from "../../lib/use-api-resource";
import type { BrowserApiError } from "../../lib/api";
import type { Workspace } from "../../lib/workspaces";
import type { EventItem } from "../../lib/entries";
import { ErrorState, LoadingState, Screen } from "../components/ui";
import CategoryList from "./category-list";
import { DeleteEntry, RenameEntry } from "./entry-controls";

function EntryStatus({ error, retry }: { error: BrowserApiError | null; retry: () => void }) {
  return <Screen title={error?.status === 404 ? "記録が見つかりません" : "記録を読み込み中"}>
    {error ? <>
      <ErrorState message={error.status === 404 ? "削除されたか、この記録にアクセスできない可能性があります。" : error.message} onRetry={error.status === 404 ? undefined : retry} />
      <Link href="/workspaces" className="btn btn-secondary">Workspace一覧へ戻る</Link>
    </> : <LoadingState />}
  </Screen>;
}

export function EventDetail({ workspaceId, eventId }: { workspaceId: string; eventId: string }) {
  const workspace = useApiResource<Workspace>(`/api/workspaces/${workspaceId}`);
  const apiPath = `/api/workspaces/${workspaceId}/events/${eventId}` as const;
  const event = useApiResource<EventItem>(apiPath);
  const error = workspace.error ?? event.error;
  if (error || !workspace.data || !event.data) return <EntryStatus error={error} retry={() => { workspace.retry(); event.retry(); }} />;
  const parentHref = `/workspaces/${workspaceId}`;
  const href = `${parentHref}/events/${eventId}`;
  return <Screen title={event.data.name} breadcrumbs={[
    { label: "Workspace一覧", href: "/workspaces" }, { label: workspace.data.name, href: parentHref }, { label: event.data.name },
  ]}>
    <RenameEntry apiPath={apiPath} label="出来事" name={event.data.name}
      onSaved={(name) => event.setData((current) => current && { ...current, name })} />
    <CategoryList apiPath={`${apiPath}/categories`} eventHref={href} />
    <DeleteEntry apiPath={apiPath} label="出来事" name={event.data.name} parentHref={parentHref} childrenLabel="分類・メモ" />
  </Screen>;
}

