import { Suspense } from "react";

const errors: Record<string, string> = {
  oauth: "ログインを完了できませんでした。もう一度Googleでログインしてください。",
  session: "ログインの有効期限が切れました。もう一度ログインしてください。",
  config: "APIの接続設定を確認してください。",
};

async function LoginMessage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return error && errors[error] ? <p role="alert" className="mb-6 text-red-700">{errors[error]}</p> : null;
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <main className="flex flex-1 py-12 items-center justify-center bg-slate-50 px-6">
    <div className="w-full max-w-md text-center">
      <h1 className="mb-4 text-3xl font-bold text-slate-800">ログイン</h1>
      <p className="mb-8 text-slate-600">Googleアカウントでログインしてください</p>
      <Suspense fallback={null}><LoginMessage searchParams={searchParams} /></Suspense>
      <a href="/auth/login" className="btn btn-primary">
        Googleでログイン
      </a>
    </div>
  </main>;
}
