"use client";

import { useEffect, useState } from "react";
import { browserApi, BrowserApiError, type WorkspaceApiPath } from "./api";

export function useApiResource<T>(path: WorkspaceApiPath) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<BrowserApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Activityで画面が再表示された場合も再取得し、作成・削除前の一覧を残さない。
  useEffect(() => {
    let active = true;
    browserApi<T>(path).then(
      (result) => { if (active) { setData(result); setError(null); } },
      (failure: BrowserApiError) => { if (active) setError(failure); },
    );
    return () => { active = false; };
  }, [path, attempt]);

  function retry() {
    setData(null);
    setError(null);
    setAttempt((value) => value + 1);
  }
  return { data, error, retry };
}
