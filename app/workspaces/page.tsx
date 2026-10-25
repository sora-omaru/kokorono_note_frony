import Link from "next/link";

type Workspace = {
  id: string;
  name: string;
};


//ダミーデータ
const workspaces: Workspace[] = [
  { id: "1", name: "家族の心のノート" },
  { id: "2", name: "旅行の記録" },
];

export default function WorkspacesPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-3xl font-bold text-slate-800">Workspaces</h1>

        <div className="mb-6 flex items-center justify-between">
          <p className="text-slate-600">参加しているWorkspace</p>

          <Link
            href="/workspaces/new"
            className="rounded-lg bg-slate-800 px-4 py-2 text-white hover:bg-slate-700"
          >
            + 新規作成
          </Link>
        </div>

        {workspaces.length === 0 ? (
          <p className="rounded-lg bg-white p-6 text-center text-slate-500">
            Workspaceがありません
          </p>
        ) : (
          <div className="space-y-4">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="rounded-lg border border-slate-200 bg-white p-5"
              >
                <h2 className="text-lg font-semibold text-slate-800">
                  {workspace.name}
                </h2>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
