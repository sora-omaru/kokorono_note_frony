import type { Metadata } from "next";
import { Screen } from "../components/ui";

export const metadata: Metadata = {
  title: "利用規約",
  description: "心のノートの利用条件について。",
};

const sectionClass = "space-y-3 leading-7 text-slate-700";
const headingClass = "section-title text-xl font-bold";

export default function TermsPage() {
  return (
    <Screen title="利用規約" description="心のノートを利用する際の条件を定めます。">
      <section className={sectionClass}>
        <h2 className={headingClass}>サービスの利用</h2>
        <p>心のノートは、出来事に関する記録を作成し、Workspaceに参加する人と共有・編集するサービスです。利用にはGoogleアカウントでのログインが必要です。利用者は本規約に従ってサービスを利用してください。</p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>記録と共有</h2>
        <p>利用者は、自分が記録する内容について責任を負います。他人の権利やプライバシーを侵害する情報を、必要な許可なく登録しないでください。</p>
        <p>Workspaceの参加者は、共有された記録を閲覧・編集できます。招待コードは参加させたい相手にのみ共有し、共有する情報の内容を参加者間で確認してください。記録を削除すると復元できない場合があります。</p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>禁止事項</h2>
        <p>次の行為を禁止します。</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>法令に違反する行為、または他人の権利・プライバシーを侵害する行為</li>
          <li>他人になりすまして利用する行為、または許可なく他人のWorkspaceへアクセスする行為</li>
          <li>招待コードや認証情報を不正に取得・使用する行為</li>
          <li>サービスの運用を妨げる行為、または不正な方法でシステムへアクセスする行為</li>
        </ul>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>サービスの変更・停止</h2>
        <p>保守、障害への対応などのため、サービスの内容を変更し、または提供を一時停止する場合があります。重要な変更は適切な方法でお知らせします。</p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>免責事項</h2>
        <p>サービスの継続的な提供、記録の完全な保存、掲載内容の正確性を保証するものではありません。利用者は必要に応じて大切な記録を別途保管してください。サービスの利用に伴う損害については、適用される法令に従って対応します。</p>
      </section>

      <section className={sectionClass}>
        <h2 className={headingClass}>規約の変更</h2>
        <p>本規約を変更するときは、このページの内容を更新し、変更内容に応じて適切な方法でお知らせします。</p>
      </section>
    </Screen>
  );
}
