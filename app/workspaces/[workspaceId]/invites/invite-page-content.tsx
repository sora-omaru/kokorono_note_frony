"use client";

import Link from "next/link";
import { useApiResource } from "../../../../lib/use-api-resource";
import type { Workspace } from "../../../../lib/workspaces";
import { ErrorState, LoadingState, Screen } from "../../../components/ui";
import InviteIssuer from "../../invite-issuer";

export default function InvitePageContent({ workspaceId }: { workspaceId: string }) {
  const { data: workspace, error, retry } = useApiResource<Workspace>(`/api/workspaces/${workspaceId}`);
  const workspaceHref = `/workspaces/${workspaceId}`;
  const missing = error?.status === 404;
  return <Screen title={missing ? "Workspaceが見つかりません" : "招待コードを発行"} description="このWorkspaceへ一緒に記録する人を招待できます。"
    breadcrumbs={[{ label: "Workspace一覧", href: "/workspaces" }, { label: workspace?.name ?? "Workspace", href: workspaceHref }, { label: "招待コード" }]}>
    {error ? <ErrorState message={missing ? "削除されたか、このWorkspaceに参加していない可能性があります。" : error.message} onRetry={missing ? undefined : retry} /> :
      !workspace ? <LoadingState /> : <InviteIssuer workspaceId={workspaceId} />}
    <Link href={missing ? "/workspaces" : workspaceHref} className="btn btn-secondary">{missing ? "Workspace一覧へ戻る" : "Workspaceへ戻る"}</Link>
  </Screen>;
}
