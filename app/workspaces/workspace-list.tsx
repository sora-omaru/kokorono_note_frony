"use client";

import { useEffect, useState } from "react";
import { browserApi } from "../../lib/api";

type Workspace = { id: string; name: string };

export default function WorkspaceList() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    browserApi<Workspace[]>("/api/workspaces").then(
      (data) => {
        if (active) setWorkspaces(data);
      },
      (error: Error) => {
        if (active) setError(error.message);
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-3xl font-bold text-slate-800">
          参加しているWorkspace
        </h1>
        {error ? (
          <div role="alert" className="rounded-lg bg-white p-6 text-slate-800">
            <p>{error}</p>
            <button
              className="mt-4 rounded bg-slate-800 px-4 py-2 text-white"
              onClick={() => {
                setError("");
                setAttempt((value) => value + 1);
              }}
            >
              再試行
            </button>
          </div>
        ) : workspaces === null ? (
          <p role="status">読み込み中…</p>
        ) : workspaces.length === 0 ? (
          <p className="rounded-lg bg-white p-6 text-slate-600">
            Workspaceがありません
          </p>
        ) : (
          <ul className="space-y-4">
            {workspaces.map((workspace) => (
              <li
                key={workspace.id}
                className="rounded-lg border border-slate-200 bg-white p-5 text-slate-800"
              >
                {workspace.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
