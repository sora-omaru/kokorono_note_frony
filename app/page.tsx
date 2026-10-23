
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md text-center">
        <h1 className="mb-4 text-4xl font-bold text-slate-800">
          心のノート
        </h1>

        <p className="mb-8 text-slate-600">
          大切な思い出や、次に活かしたいことを
          記録・共有するアプリ
        </p>

        <Link
          href="/login"
          className="inline-block rounded-lg bg-slate-800 px-8 py-3 text-white hover:bg-slate-700"
        >
          ログイン
        </Link>
      </div>
    </main>
  );
}
