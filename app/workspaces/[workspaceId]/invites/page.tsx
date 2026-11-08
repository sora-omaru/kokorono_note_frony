import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { isWorkspaceId } from "../../../../lib/workspaces";
import { LoadingState } from "../../../components/ui";
import InvitePageContent from "./invite-page-content";

export const instant = false;

async function Content({ params }: { params: Promise<{ workspaceId: string }> }) {
  await connection();
  const { workspaceId } = await params;
  if (!isWorkspaceId(workspaceId)) notFound();
  return <InvitePageContent workspaceId={workspaceId} />;
}

export default function InvitePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  return <Suspense fallback={<main className="mx-auto w-full max-w-3xl p-6"><LoadingState /></main>}>
    <Content params={params} />
  </Suspense>;
}
