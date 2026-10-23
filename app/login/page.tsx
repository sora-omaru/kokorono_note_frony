export default function LoginPage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md text-center">
        <h1 className="mb-4 text-3xl font-bold text-slate-800">ログイン</h1>

        <p className="mb-8 text-slate-600">
          Googleアカウントでログインしてください
        </p>

        {apiBaseUrl ? (
          <a
            href={`${apiBaseUrl}/oauth2/authorization/google`}
            className="inline-block rounded-lg bg-slate-800 px-8 py-3 text-white hover:bg-slate-700"
          >
            Googleでログイン
          </a>
        ) : (
          <p className="text-red-600">APIの接続先が設定されていません</p>
        )}
      </div>
    </main>
  );
}
