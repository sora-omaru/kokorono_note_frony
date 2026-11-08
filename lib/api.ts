let queue: Promise<unknown> = Promise.resolve();

/** 同一Origin・複数タブで認証Cookieの更新を直列化する。 */
export async function browserApi<T>(path: "/api/workspaces", init?: RequestInit): Promise<T> {
  const send = async () => {
    const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store" });
    if (response.status === 401) {
      window.location.replace("/login?error=session");
      throw new Error("ログインしてください");
    }
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message ?? "通信に失敗しました");
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
