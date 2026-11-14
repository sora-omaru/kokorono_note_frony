import type { Metadata } from "next";
import { Screen } from "../components/ui";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "心のノートにおける情報の取扱いについて。",
};

const sectionClass = "space-y-3 leading-7 text-slate-700";
const headingClass = "section-title text-xl font-bold";

export default function PrivacyPage() {
  return (
    <Screen title="プライバシーポリシー" description="心のノートで取り扱う情報と、その利用方法を説明します。">
      <section className={sectionClass}>
        <h2 className={headingClass}>取得する情報</h2>
        <p>Googleアカウントでのログイン時に、Googleが提供するユーザー識別子（sub）と表示名を取得します。サービス内ではアカウントを識別するためのIDも発行します。メールアドレスはアカウント情報として保存していません。</p>
        <p>利用者が入力したWorkspace、出来事、分類の名称とメモの本文、Workspaceへの参加情報、招待に関する情報を取り扱います。ログイン状態の維持に必要な認証情報とCookieも使用します。</p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>利用目的</h2>
        <p>本人確認とログイン状態の維持、記録の保存・表示・編集、Workspace内での共有と招待、サービスの安全な運用のために利用します。</p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>保存方法</h2>
        <p>アカウント情報と利用者が作成した記録は、バックエンドを通じてデータベースに保存します。認証に必要な情報はHttpOnly Cookieで扱い、フロントエンドの認証Cookieには暗号化して保存します。バックエンドではRefresh Tokenそのものではなく、そのハッシュ値を保存します。GoogleのRefresh Tokenは保存しません。</p>
        <p>Workspaceを削除すると、その中の出来事、分類、メモ、招待と参加情報も削除されます。現時点でアカウント自体を削除する画面はありません。</p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>共有と外部サービス</h2>
        <p>Workspace内の記録は、そのWorkspaceに参加する利用者が閲覧・編集できます。招待コードを渡す相手は、参加後に同じ記録を利用できるため、コードの共有先にご注意ください。</p>
        <p>ログインにはGoogleを使用します。サービスの提供には、フロントエンドの配信にVercel、バックエンドの稼働にRender、データベースの運用にSupabaseを利用する予定です。これらのサービスは、それぞれの役割に必要な範囲で情報を処理します。法令に基づく場合などを除き、上記以外の目的で利用者の情報を第三者へ提供しません。</p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>変更について</h2>
        <p>情報の取扱いを変更するときは、このページの内容を更新します。</p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>お問い合わせ</h2>
      </section>
    </Screen>
  );
}
