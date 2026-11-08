"use client";

import Link from "next/link";
import { useApiResource } from "../../../../lib/use-api-resource";
import type { Workspace } from "../../../../lib/workspaces";
import { ErrorState, LoadingState, Screen } from "../../../components/ui";
import InviteIssuer from "../../invite-issuer";

export default function InvitePageContent({ workspaceId }: { workspaceId: string }) {
  const { data: workspace, error, retry } = useApiResource<Workspace>(`/api/workspaces/${workspaceId}`);
  const workspaceHref = `/workspaces/${workspaceId}`;
  return <Screen title="招待コードを発行" description="このWorkspaceへ一緒に記録する人を招待できます。"
    breadcrumbs={[{ label: "Workspace一覧", href: "/workspaces" }, { label: workspace?.name ?? "Workspace", href: workspaceHref }, { label: "招待コード" }]}>
    {error ? <ErrorState message={error.message} onRetry={error.status === 404 ? undefined : retry} /> :
      !workspace ? <LoadingState /> : <InviteIssuer workspaceId={workspaceId} />}
    <Link href={workspaceHref} className="btn btn-secondary">Workspaceへ戻る</Link>
  </Screen>;
}
