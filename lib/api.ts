let queue: Promise<unknown> = Promise.resolve();

export type WorkspaceApiPath = "/api/workspaces" | `/api/workspaces/${string}`;

export class BrowserApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/** 同一Origin・複数タブで認証Cookieの更新を直列化する。 */
export async function browserApi<T>(path: WorkspaceApiPath, init?: RequestInit): Promise<T> {
  const send = async () => {
    let response: Response;
    try {
      response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store" });
    } catch {
      throw new BrowserApiError(0, "通信に失敗しました。接続を確認して再試行してください。");
    }
    if (response.status === 401) {
      window.location.replace("/login?error=session");
      throw new BrowserApiError(401, "ログインしてください");
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new BrowserApiError(response.status, typeof data?.message === "string" ? data.message : "通信に失敗しました");
    }
    return response.status === 204 ? undefined as T : await response.json() as T;
  };
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("kokorono-api", send);
  }
  const result = queue.then(send, send);
  queue = result.catch(() => {});
  return result;
}
