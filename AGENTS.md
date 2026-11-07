<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# このポケだーれ?(kono-poke-dare)

## 共通の開発ルール

- 実装、設計、Issue の起票、PR の作成、レビューでは `coding-standards` Skill に従う。Claude Code では `.claude/skills/coding-standards/SKILL.md`、Codex では `$coding-standards` を使う
- オニオンアーキテクチャ、TDD、セキュアコードを守る。機能仕様は `docs/specs/` に記録する
- 新規機能は実装前に Issue を起票する。複数領域にまたがる作業や、1 PR でレビューしきれない作業は Sub Issue に分ける。PR 本文で Issue を参照する
- 実装は親のチェックアウトで直接行わず、`scripts/worktree.sh new <branch>` で作成した Git worktree で行う。PR のマージ後、親のチェックアウトで `scripts/worktree.sh clean` を実行する
- 既存の問題データを全世代にわたって変更するときは `parallel-data-change` Skill に従う。Claude Code では `.claude/skills/parallel-data-change/SKILL.md`、Codex では `$parallel-data-change` を使う
- Next.js のコードを書く前に、変更に関係する `node_modules/next/dist/docs/` のガイドを読む。上のNext.js管理ブロックは `next dev` が再生成するため、削除・編集しない

## 開発コマンド

PR の前に `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm e2e` を実行して成功を確認する。CI (`.github/workflows/ci.yml`) も同じ内容を実行する。`pnpm e2e` の前には `pnpm build` を実行する。

`pnpm lint` はオニオンの層をまたぐ禁止 import も検出する。PR 本文の Issue 参照は `.github/workflows/issue-link.yml` が確認する。

## GitHub と Git の操作アカウント

このリポジトリの Issue、PR、コミットはすべて `eddie-splatoon` 名義にする。他の人間のアカウント名やメールアドレスを、コミット履歴、PR、Issue、リポジトリ内のファイルに書かない。`gh auth switch` は他のリポジトリにも影響するので使わない。

GitHub CLI を使う前に、次のコマンドの結果が `eddie-splatoon` であることを確認する。アカウントを確認できない、または別のアカウントの場合は `gh` と `git push` を実行しない。実際の `gh` コマンドにも同じように `GH_TOKEN` を指定する。

```sh
GH_TOKEN="$(gh auth token --user eddie-splatoon)" gh api user --jq .login
GH_TOKEN="$(gh auth token --user eddie-splatoon)" gh issue list
```

コミット前に `git config user.name` が `eddie-splatoon` であることを確認する。Git のユーザー名、メールアドレス、credential helper は clone ごとのローカル設定で管理し、設定方法は `CLAUDE.md` の「clone し直したとき」を参照する。

## 関連ドキュメント

- コーディング規約: `.claude/skills/coding-standards/`
- 機能仕様: `docs/specs/`
- 脆弱性の報告: `SECURITY.md`
