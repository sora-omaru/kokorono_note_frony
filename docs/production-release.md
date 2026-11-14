# フェーズ6：公開準備と確認手順

対象構成は Vercel（Next.js）→ Render（Spring Boot）→ Supabase（PostgreSQL）。この文書は公開前の記入・確認用であり、公開作業の実施記録ではない。サービスの設定項目は公開時に公式資料で再確認する。

## T28：設定と公開前ゲート

公開時に、フロントと API の確定した HTTPS URL、両リポジトリのコミット ID、各サービスの Deployment ID、DB のバックアップ時点を記録する。秘密値自体は記録しない。

| 配置先 | 設定 | 実装上の用途 |
| --- | --- | --- |
| Vercel Production | `API_BASE_URL=https://<APIドメイン>` | Next.js サーバーから Render API への接続先。末尾の `/` は任意。ブラウザー公開用の `NEXT_PUBLIC_` 変数にしない。 |
| Vercel Production | `AUTH_SESSION_SECRET` | 32バイトを16進数にした64文字。全実行インスタンスで同じ値を使い、安全に保管する。変更すると既存セッションは無効になる。 |
| Render | `SPRING_PROFILES_ACTIVE=prod` | `application-prod.yml` を有効にする。 |
| Render | `DATABASE_URL`、`DATABASE_USERNAME`、`DATABASE_PASSWORD` | Supabase の接続情報。URL は `jdbc:postgresql://...` 形式。TLS と接続方式を確定してから登録する。 |
| Render | `JWT_PRIVATE_KEY`、`JWT_PUBLIC_KEY` | 同じ本番用 RSA 鍵ペア。PKCS#8 / X.509 DER の Base64。ローカル用とは分ける。 |
| Render | `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` | Google OAuth の Web アプリ用クライアント。 |
| Render | `FRONTEND_URL=https://<フロントの正式ドメイン>` | OAuth 成功・失敗時の戻り先。末尾に `/` を付けない。 |

Vercel は本リポジトリのルートを Next.js プロジェクトとして取り込み、`npm ci` で依存を固定し、ビルドは `npm run build`、サーバー起動は Next.js のプラットフォーム設定に従う。静的エクスポートにはしない。`API_BASE_URL` と `AUTH_SESSION_SECRET` はサーバーだけで使用する。設定変更後は新しいデプロイで適用を確認する。

Render はバックエンドのリポジトリを Web Service / Language: Docker として取り込み、ルートの Dockerfile から Java 21 の JAR を Maven でビルドし、JRE イメージで起動する。追加の Build Command / Start Command は設定しない。`SPRING_PROFILES_ACTIVE=prod` を指定し、Render が提供する `PORT` を本番プロファイルの `server.port` で読む。OAuth の HTTPS リダイレクトには本番プロファイルの転送ヘッダー設定を使う。ローカルのイメージビルドとテストの方法はバックエンドの [開発手順](../../kokorono_note_api/docs/local-development.md) を参照する。HTTP の公開ヘルスチェックパスは追加していないため、公開時は Render の標準 TCP ヘルスチェックから始め、アプリ起動と認証はスモークテストで確認する。

Supabase の DB 接続先は Render から到達できる **IPv4 対応の session pooler** を第一候補とし、Supabase の Connect 画面からホスト、ポート、ユーザー名をそのまま取得する。Render は外向き IPv6 非対応で、Supabase の直接接続先は通常 IPv6 のため、直接接続 URL を無条件に使わない。JDBC と Flyway の動作、TLS 設定、接続数を実環境で確認する。transaction pooler はセッション状態や prepared statement の制約があるため、未検証で切り替えない。

Flyway はバックエンド起動時に `db/migration/V1`〜`V8` を適用し、Hibernate は本番で `ddl-auto: validate`。初回公開前に対象 DB が空か、既存の `flyway_schema_history` と衝突しないかを確認する。DB のバックアップ／復元手段を先に確保し、マイグレーション後にスキーマ検証とアプリ起動を確認する。本番 DB をローカルテストの接続先にしない。

Google Cloud の OAuth Web クライアントには **API 側**の `https://<APIドメイン>/login/oauth2/code/google` を承認済みリダイレクト URI として正確に登録する。フロント側 `/oauth/callback` は Spring Boot からの戻り先であり、Google のリダイレクト URI と取り違えない。ログイン開始はフロントの `/login` → `/auth/login`。Google OAuth の公開状態、テストユーザー制限、ドメインの HTTPS 証明書も確認する。

Cookie はフロントの `kn_login_flow` と `kn_session` が `HttpOnly; Secure; SameSite=Lax; Path=/`、バックエンドの `refreshToken` が prod で `HttpOnly; Secure; SameSite=Lax; Path=/auth`。Spring Security の CSRF セッション Cookie は Next.js サーバーが取得し、暗号化されたフロントのセッション Cookie に保存した ID を API に送る。ブラウザーから API の Cookie を直接送信する設計ではない。別ドメインだからという理由だけで `SameSite=None` に変更しない。

## T29：HTTPS 認証確認

公開依頼後、テスト用の独立した Google アカウントとブラウザーを使い、正式なフロントドメインで次を順に確認する。Cookie 値、コード、トークンは記録しない。

1. `/workspaces` の未認証アクセスが `/login` に戻る。フロントからログインを開始し、Google → API の OAuth コールバック → フロント `/oauth/callback` → Workspace 一覧へ遷移する。リダイレクト先のドメインと HTTPS を確認する。
2. ブラウザー開発ツールでフロントの `kn_session` が `HttpOnly`・`Secure`・`SameSite=Lax` で保存されることを**属性だけ**確認する。再読み込み後も一覧を取得できることを確認する。バックエンドの `refreshToken` はブラウザーのフロントドメインに保存されない。
3. Workspace と Event を作成し、一覧と詳細の再取得を確認する。API の更新リクエストが 2xx で、Next.js サーバー経由で CSRF トークン・対応セッションを送れていることを、値を出さずにステータスとアプリ動作で確認する。403 があれば API 側の CSRF/所属確認を調べる。
4. Access Token が期限切れになるのを待って同じ画面から再取得・更新し、401 後の一度の Refresh と再試行が成功することを確認する。複数タブでも確認する。Refresh Token の期限切れまたは無効時はログインへ戻ることを確認する。
5. 別ユーザーの非所属 Workspace に直接アクセスできないこと、招待コードで参加して共同編集できることを確認する。テストで作ったデータは画面の通常操作で片付ける。

Vercel の Function ログ、Render のサービスログ、ブラウザーのネットワーク画面ではステータス、時刻、対象経路のみ扱う。URL クエリの一時コード、`Cookie`、`Authorization`、CSRF 値は共有・転記しない。Vercel の実行インスタンスをまたぐ同時更新や Web Locks 非対応ブラウザーでは再ログインが必要になる可能性があるため、T29 で対象ブラウザー・配置構成を記録する。

## T30：障害時の確認と復旧

公開前の記録欄：フロントコミット `未記入`、API コミット `未記入`、Vercel Deployment ID `未記入`、Render Deploy ID `未記入`、環境設定の変更内容（**名前のみ**）`未記入`、DB バックアップ方法・取得時刻 `未記入`、DB マイグレーション版 `未記入`。

1. 障害時は新規の公開操作を止め、Vercel / Render のデプロイ状態とログ、Supabase の接続状態、Google OAuth のエラーを時刻で突き合わせる。原因がフロント、API、DB、設定のどこかを確認する。
2. フロントだけの不具合なら Vercel の Production Deployment から直前の正常なデプロイへ Instant Rollback し、正式ドメインでログインと一覧を再確認する。ロールバック先の環境変数・外部 API との整合を確認する。
3. API の不具合なら Render の対象サービスで直前の正常なデプロイへ Rollback し、ログと起動・認証を再確認する。ロールバック後に自動デプロイ設定の状態も確認する。
4. 環境変数の誤設定なら値を安全な管理画面で修正し、対象サービスの再デプロイ後に確認する。秘密値をチケットやチャットへ貼らない。
5. DB 変更が原因なら、アプリ版だけ戻してもスキーマは戻らない。マイグレーションの後方互換性を先に評価する。データ復元が必要な場合はサービス停止と影響範囲を判断し、Supabase のバックアップ／PITR または事前に確保したダンプから復元する。復元時点以降の更新が失われ得るため、復元を独断で実行しない。

## 参照（公開時に再確認）

- [Next.js の環境変数](https://nextjs.org/docs/app/guides/environment-variables)、[Vercel の環境変数](https://vercel.com/docs/environment-variables)、[Vercel Instant Rollback](https://vercel.com/docs/instant-rollback)
- [Render の Docker デプロイ](https://render.com/docs/docker)、[Render の Rollback](https://render.com/docs/rollbacks)、[Render と Supabase の接続](https://render.com/articles/how-to-connect-a-render-service-to-supabase-postgres)
- [Supabase の接続方式](https://supabase.com/docs/guides/database/connecting-to-postgres)、[バックアップと復元](https://supabase.com/docs/guides/platform/backups)
- [Google OAuth の Web サーバー向け設定](https://developers.google.com/identity/protocols/oauth2/web-server)
