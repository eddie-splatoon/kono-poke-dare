# セキュアコード

このリポジトリは公開されている。コードを読まれても安全であるように書く。

Next.js の書き方は、次の導入済みドキュメントも確認する(このリポジトリの Next.js は学習データと異なることがある)。

- `node_modules/next/dist/docs/01-app/02-guides/data-security.md`
- `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`

## 正解データの保護

このゲームで最も守るものは、当日の正解である。

- 正解をサーバーの外に出さない。Client Component の props、Server Action の戻り値、API のレスポンス、HTML、ログに含めない
- クライアントへは、必要な項目だけの DTO を渡す。エンティティや DB の行をそのまま渡さない
- ヒントは進行に合わせて 1 件ずつ返す。未公開のヒントを返さない
- 回答の判定はサーバーだけで行う
- 問題データをリポジトリの公開ファイルや `public/` に置く場合は、公開されてよいかを Issue で確認する

## 不正の防止

- 「1 日 1 回」は DB の一意制約で保証する
- ユーザー ID は、入力値ではなく、サーバーで検証したセッションから取得する
- ヒント番号や得点をクライアントから受け取らない。サーバーの進行状況から求める

## Server Action と Route Handler

- 公開エンドポイントとして扱う。画面の出し分けを防御とみなさない
- 呼び出しのたびに、認証、認可、入力検証を行う
- `FormData`、クエリ、ヘッダーをすべて信頼しない。受け取った時点で、型と範囲を検証する
- 戻り値は必要最小限にする
- 回答のエンドポイントには、レート制限の要否を検討する

## サーバー専用のコード

- DB や秘密情報に触れるモジュールには `import "server-only"` を付ける
- 秘密情報に `NEXT_PUBLIC_` を付けない
- `process.env` は `infrastructure` だけで読む

## 一般的な規則

- SQL は Drizzle のパラメータ化を使う。ユーザー入力を `sql.raw` に渡さない
- `dangerouslySetInnerHTML` は原則として使わない。使うときは理由を PR に書く
- 秘密情報、正解、個人情報をログに残さない
- エラーの詳細(スタックトレース、SQL)をクライアントへ返さない
- トークンやパスワードをコミットしない。`.env*` をコミットしない
- 新しい依存を追加するときは、必要性と提供元を確認する

## CI

- アクションはコミット SHA で固定する
- `permissions` を最小にする
- `pull_request_target` を使わない
- PR の本文やタイトルは `${{ }}` で `run` に直接埋め込まず、環境変数で渡す(`.github/workflows/identity.yml` の方式)
- `actions/checkout` には `persist-credentials: false` を付ける

## 権利

公式の画像、ロゴ、音声を追加しない。権利に関わる判断は、`legal` ラベルの Issue で行う。

## 脆弱性の報告

脆弱性や正解データの漏えいは、公開の Issue や PR に詳細を書かない。[`SECURITY.md`](../../../../SECURITY.md) の窓口を使う。

## レビュー

PR の前に `/security-review` を実行し、指摘に対応する。
