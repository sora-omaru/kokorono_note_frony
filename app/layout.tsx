import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "心のノート", template: "%s | 心のノート" },
  description: "旅行や日々の出来事で気づいたことを記録し、家族や友人と共有する心のノート。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">本文へスキップ</a>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
            <Link href="/" className="rounded text-xl font-bold tracking-tight text-slate-900">心のノート</Link>
            <nav aria-label="メインメニュー"><Link href="/workspaces" className="rounded text-sm font-medium text-slate-600 hover:text-slate-900">Workspace一覧</Link></nav>
          </div>
        </header>
        <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
