---
title: worktree の補助ツール
status: implemented # draft | implemented | deprecated
issues: [8]
code: [scripts/worktree.sh]
tests: [scripts/worktree.test.ts]
updated: 2026-11-05
---

# worktree の補助ツール

## 概要

並列セッションで開発するために、ブランチごとの Git worktree を作成し、PR のマージ後に削除する開発用のスクリプトである。運用の手順は [`coding-standards` Skill の worktree.md](../../.claude/skills/coding-standards/references/worktree.md) に書く。

## 要件

| ID   | 要件                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------- |
| R-1  | `new <branch>` は `.claude/worktrees/<slug>` に、`origin/main` から分岐した新しいブランチの worktree を作る               |
| R-2  | `new <branch> --base <ref>` は `<ref>` から分岐する。`<ref>` が存在しなければ 0 以外で終了し、何も作らない                 |
| R-3  | `new` は作成した worktree で `pnpm install --frozen-lockfile` を実行し、worktree の絶対パスを標準出力の最終行に出す        |
| R-4  | 既存のブランチ名や、ブランチ名として不正な文字列を渡すと、0 以外で終了し、何も作らない                                     |
| R-5  | `clean` は、PR がマージ済みで、`HEAD` が PR の head と一致し、変更のない worktree とそのローカルブランチを削除する         |
| R-6  | `clean` は、PR がない worktree と、PR が未マージの worktree を残す                                                         |
| R-7  | `clean` は、未コミットの変更または追跡外のファイルがある worktree を残す                                                   |
| R-8  | `clean` は、`HEAD` が PR の head と異なる worktree を残す                                                                  |
| R-9  | `clean` は、実行中の worktree 自身を残す                                                                                   |
| R-10 | `clean` は、親のチェックアウトと、`.claude/worktrees/` の外にある worktree を対象にしない                                  |
| R-11 | `gh` の操作アカウントが `eddie-splatoon` でないとき、または `gh` が失敗したとき、`clean` は削除せずに 0 以外で終了する     |
| R-12 | `new` は、事前に実行する `clean` が失敗しても worktree を作る                                                              |
| R-13 | `GH_TOKEN` が未設定のとき、`eddie-splatoon` のトークンで `gh` を実行する                                                   |

## ドメインルール

- `<slug>` は、ブランチ名の `/` を `-` に置き換えたものとする
- 親のチェックアウトは `git rev-parse --git-common-dir` から求める。どの worktree から実行しても同じ結果になる

## 入出力

| コマンド                                | 標準出力                                   | 終了コード                 |
| --------------------------------------- | ------------------------------------------ | -------------------------- |
| `scripts/worktree.sh new <branch> [--base <ref>]` | 最終行が worktree の絶対パス      | 成功は 0、失敗は 0 以外    |
| `scripts/worktree.sh clean`             | 削除した worktree と、残した worktree と理由 | 成功は 0、失敗は 0 以外    |

引数が不正なときは、使い方を標準エラーに出して 2 で終了する。

## エラー

- `pnpm install` に失敗したら、worktree を残したまま 0 以外で終了し、残した場所を表示する
- `git worktree remove` に失敗したら(ロックされている場合など)、そこで 0 以外で終了する

## セキュリティ

- トークンをファイルやログに書かない。`GH_TOKEN` はスクリプトのプロセス内でだけ設定する
- ブランチ名と分岐元はすべて検証してから、引用符で囲んで `git` に渡す
- `git worktree remove` に `--force` を付けない
- `.gitignore` の対象のファイル(`node_modules`、`.env*` など)は、削除時に確認なしで一緒に消える

## 対象外

- リモートのブランチの削除(リポジトリ設定の自動削除に任せる)
- 親のチェックアウトの更新
