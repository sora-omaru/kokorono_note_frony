import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { openSession, SESSION_COOKIE } from "../../lib/server/session";
import { LoadingState } from "../components/ui";

// 認証判定とログインへの遷移はリクエストを待つため、この境界は即時遷移検証の対象外にする。
export const instant = false;

async function RequireSession({ children }: { children: React.ReactNode }) {
  // 有効期限の判定はプリレンダリングやprefetchではなく実リクエストで行う。
  await connection();
  const store = await cookies();
  if (!openSession(store.get(SESSION_COOKIE)?.value)) redirect("/login");
  return children;
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main className="mx-auto w-full max-w-3xl p-6"><LoadingState /></main>}>
    <RequireSession>{children}</RequireSession>
  </Suspense>;
}
