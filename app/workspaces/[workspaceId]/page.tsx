import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { isWorkspaceId } from "../../../lib/workspaces";
import { LoadingState } from "../../components/ui";
import WorkspaceDetail from "./workspace-detail";

export const instant = false;

async function Detail({ params }: { params: Promise<{ workspaceId: string }> }) {
  await connection();
  const { workspaceId } = await params;
  if (!isWorkspaceId(workspaceId)) notFound();
  return <WorkspaceDetail key={workspaceId} workspaceId={workspaceId} />;
}

export default function WorkspaceDetailPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  return <Suspense fallback={<main className="mx-auto w-full max-w-3xl p-6"><LoadingState /></main>}>
    <Detail params={params} />
  </Suspense>;
}
