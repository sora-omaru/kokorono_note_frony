import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { isWorkspaceId } from "../../../../../lib/workspaces";
import { isEntryId } from "../../../../../lib/entries";
import { LoadingState } from "../../../../components/ui";
import { EventDetail } from "../../../entry-detail";

export const instant = false;

type Params = Promise<{ workspaceId: string; eventId: string }>;
async function Detail({ params }: { params: Params }) {
  await connection();
  const { workspaceId, eventId } = await params;
  if (!isWorkspaceId(workspaceId) || !isEntryId(eventId)) notFound();
  return <EventDetail key={`${workspaceId}/${eventId}`} workspaceId={workspaceId} eventId={eventId} />;
}

export default function EventPage({ params }: { params: Params }) {
  return <Suspense fallback={<main className="mx-auto w-full max-w-3xl p-6"><LoadingState /></main>}><Detail params={params} /></Suspense>;
}
