
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-6 py-16">
      <div className="home-card w-full max-w-xl text-center">
        <Image
          src="/illustrations/socost-travelers.svg"
          alt="旅行に出かける2人のイラスト"
          width={274}
          height={432}
          className="mx-auto mb-6 h-48 w-auto sm:h-56"
          priority
        />
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-slate-800 sm:text-5xl">
          心のノート
        </h1>

        <p className="mb-8 text-slate-600">
          大切な思い出や、次に活かしたいことを
          記録・共有するアプリ
        </p>

        <Link
          href="/login"
          className="btn btn-primary"
        >
          ログイン
        </Link>
      </div>
    </main>
  );
}
