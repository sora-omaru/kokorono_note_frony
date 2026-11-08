import Link from "next/link";
import { Screen } from "./components/ui";

export default function NotFound() {
  return <Screen title="ページが見つかりません" description="URLが正しいか確認してください。削除されたページにはアクセスできません。">
    <Link href="/workspaces" className="btn btn-primary">Workspace一覧へ戻る</Link>
  </Screen>;
}
