# 心のノート：フロントエンド

出来事の注意点や持ち物を Workspace → Event → Category → Note の階層で整理し、複数人で共有するアプリです。
Next.js App Router / React / TypeScript / Tailwind CSS を使用します。実装順と進捗は [TODO.md](TODO.md)、作業ルールは [AGENTS.md](AGENTS.md) を参照してください。

## ローカル起動

Node.js 20.9以上とnpmを使用します。バックエンドは隣の `../kokorono_note_api` に配置します。

1. `npm ci` で依存をインストールします。
2. `.env.example` を `.env.local` にコピーします。
3. `API_BASE_URL=http://localhost:8080` と、`AUTH_SESSION_SECRET` を設定します。暗号化鍵は `openssl rand -hex 32` で生成する64文字の16進数です。値をGitやログへ保存しないでください。
4. バックエンド側で環境変数を設定し、`docker compose up -d postgres`、`./mvnw spring-boot:run` の順に起動します。詳細は [バックエンドの開発資料](../kokorono_note_api/docs/local-development.md) を参照してください。
5. このリポジトリで `npm run dev` を実行し、`http://localhost:3000/login` を開きます。

Google OAuthにはバックエンドの `http://localhost:8080/login/oauth2/code/google` をリダイレクトURIとして登録します。
API側のフロントURLはlocal設定で `http://localhost:3000`、成功後の戻り先は `/oauth/callback` です。
`localhost` と `127.0.0.1` を混在させず、ブラウザーではフロントのログイン画面から開始してください。

`AUTH_SESSION_SECRET` は全フロント実行インスタンスで同じ値を設定します。変更すると既存のログインは無効になります。
以前の `NEXT_PUBLIC_API_BASE_URL` は使用しません。API URLは `API_BASE_URL` に集約しています。

## 認証とAPI通信

- `/auth/login` がログイン用の乱数とHttpOnly Cookieを作成し、Google OAuthへ進みます。バックエンドはOAuthセッションにその乱数を保持し、コールバックでブラウザーのCookieと一致することを確認します。
- `/oauth/callback` が一時コードを交換し、Access Token、Refresh Token、CSRF用セッションIDを暗号化したHttpOnly Cookieへ保持します。ブラウザーのJavaScriptへトークンを返しません。
- ブラウザーは `lib/api.ts` の `browserApi` から同一OriginのRoute Handlerを呼びます。現在の公開入口は一覧・作成の `/api/workspaces`、詳細・削除の `/api/workspaces/[workspaceId]`、招待発行の `/api/workspaces/[workspaceId]/invites`、参加の `/api/workspaces/join` と、その配下のEvent・Category・Noteの階層CRUDです。階層APIは決められたパスとHTTPメソッドだけを受け付けます。任意のAPIパスを中継する公開入口は用意していません。
- POST・PATCH・DELETEは同一Originを検証します。バックエンドの更新APIには `/auth/csrf` のヘッダーと対応するJSESSIONIDを送ります。
- 401時はRefresh Tokenを一度だけ更新して再試行します。401が続く場合はCookieを破棄し、ログイン画面へ誘導します。403は自動更新しません。通信障害ではログイン情報を維持して再試行できます。
- ユーザーデータと認証応答は `no-store` とし、共有キャッシュに保存しません。Cookie更新はRoute Handlerで行い、Server Componentでは読み取りだけを行います。

Web Locksが利用できるHTTPSまたはlocalhostでは、`browserApi` が複数タブのAPI通信を直列化します。同一サーバープロセス内でもRefresh Tokenごとに同時更新を集約します。
Web Locksが使えないブラウザーでは同一タブ内だけの直列化になるため、複数タブかつ複数サーバーインスタンスで同時更新すると再ログインが必要になる場合があります。公開前に対応ブラウザーと配置構成で確認してください。
サーバーからのAPI呼び出しを増やす場合も、Cookie保存と更新の直列化を維持してください。

## 検証

```sh
npm run lint
npm test
npm run build
```

`npm test` はNode.jsのテスト機能とtsxで認証・CSRF・更新競合・ユーザー分離に加え、階層CRUDの入力・パス・ID精度を確認します。Spring Bootの通信はこのテストではモックします。
バックエンドの `./mvnw test` には、ローカルDBと実HTTPで一時コード交換・CSRF・Refresh Token更新を通すテストがあります。
別々のGoogleアカウントによる招待・共同編集はユーザーから動作確認済みです。自動テストはテスト用認証データを使用し、Googleログインやトークン期限切れの実ブラウザー操作を代替しません。

フロントとバックエンドを起動した状態で `npm run test:integration` を実行すると、localhostのRoute Handler→API→ローカルDBでWorkspaceからNoteまでの作成・編集、招待発行・再発行・複数人参加・共同編集・親削除に加え、登録順、親子関係・所属確認、大きいLong ID、認証更新と期限切れを確認します。
Dockerへのアクセス権が必要です。このテストはローカルの `.env` にあるJWT鍵でテスト用JWTを作り、テスト用データは終了時に削除します。鍵やトークンの値は表示しません。本番では実行しないでください。

本番ビルドは `next/font/google` の取得にネットワーク接続が必要です。この実行環境ではTurbopackのCSS処理中にポート作成が拒否されるため、`npm run build` は未完了です。
バックエンドも変更した場合は、そのリポジトリで `./mvnw test` を実行してください。

## 現在の実装範囲

フェーズ4の招待発行・再発行まで、ログイン基盤、Workspace・Event・Category・Noteの操作と、招待コードでの参加を実装しています。
一覧は `/workspaces`、作成は `/workspaces/new`、参加は `/workspaces/join` から操作できます。
削除前には配下の記録もすべて消えることを確認します。入力・通信エラーでは現在の画面と入力を維持します。
Workspace詳細から出来事を作成し、出来事詳細で分類を作成できます。分類は最初に名前だけを表示し、開くとその欄で文章のメモを追加・編集・削除できます。分類専用のページには移動しません。出来事・分類の名前も編集できます。
分類を閉じても入力中のメモは保持します。分類を作成した直後や再読み込み後は、閉じた状態から始まります。
名称は100文字以内、メモ本文は255文字以内です。メモは登録順に表示し、編集しても順番を変えません。入力中の下書きは失敗や別メモの追加でも保持します。
階層のIDはBFFで文字列として扱い、Java Longの範囲の値を丸めずにURLへ渡します。バックエンドのJSON契約は数値のままです。
Workspace一覧または詳細の「招待コードを発行」から専用ページを開き、6文字の招待コードを発行・再発行し、30分の期限を表示します。再発行すると旧コードは無効になり、期限や参加可否はバックエンドが判定します。
認証を待つ画面は `instant = false` とし、セッション期限や不正なURLの判定はリクエスト時に行います。
開発中に共通CSSの変更が表示へ反映されない場合は、開発サーバーを再起動して確認してください。
公開環境の操作は、公開依頼を受けてから実施します。
