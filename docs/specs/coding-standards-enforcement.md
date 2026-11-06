---
title: コーディング規約の機械的な確認
status: implemented # draft | implemented | deprecated
issues: [6]
code: [.github/scripts/check-issue-link.sh, .github/workflows/issue-link.yml, biome.json]
tests: [scripts/check-issue-link.test.ts, scripts/import-boundaries.test.ts]
updated: 2026-11-06
---

# コーディング規約の機械的な確認

## 概要

[`coding-standards` Skill](../../.claude/skills/coding-standards/SKILL.md) の規約のうち、機械的に判定できる 2 点を確認する。PR 本文の Issue への参照を CI で、オニオンの層をまたぐ禁止 import を `pnpm lint` で確認する。

## 要件

| ID   | 要件                                                                                     |
| ---- | ---------------------------------------------------------------------------------------- |
| R-1  | 対応するキーワードと `#番号` を含む本文は成功する                                        |
| R-2  | 番号のない `Closes #`(PR テンプレートの既定値)と、キーワードのない `#12` は失敗する      |
| R-3  | 空の本文は失敗する                                                                       |
| R-4  | HTML コメントとコードの中の参照は数えない                                                |
| R-5  | URL と `owner/repo#N` の形の参照は数えない                                               |
| R-6  | 作成者が `dependabot[bot]` の PR は、本文によらず成功する                                |
| R-7  | `src/domain` から `@/infrastructure` を import すると lint が失敗する                    |
| R-8  | `src/domain` から `next` を import すると lint が失敗する                                |
| R-9  | 「層ごとの禁止 import」の表にある import で lint が失敗し、許可された import では失敗しない |
| R-10 | `src/` の各層で親方向の相対 import(`../`)を書くと lint が失敗する                        |

## ドメインルール

### Issue への参照

キーワードは `close`、`closes`、`closed`、`fix`、`fixes`、`fixed`、`resolve`、`resolves`、`resolved`、`ref`、`refs` である。大文字と小文字を区別しない。キーワードの直後の `:` を許す。

### 層ごとの禁止 import

依存方向は [architecture.md](../../.claude/skills/coding-standards/references/architecture.md) の図に従う。

| 層               | 禁止                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `domain`         | `@/application`、`@/infrastructure`、`@/composition`、`@/app`、`@/components`、`next`、`react`、`react-dom` |
| `application`    | `@/infrastructure`、`@/composition`、`@/app`、`@/components`、`next`、`react`、`react-dom`                 |
| `infrastructure` | `@/composition`、`@/app`、`@/components`                                                               |
| `composition`    | `@/domain`、`@/app`、`@/components`                                                                    |
| `components`     | `@/domain`、`@/infrastructure`、`@/composition`、`@/app`                                               |
| `app`            | `@/domain`、`@/infrastructure`                                                                         |

サブパス(`@/infrastructure/x`、`next/link` など)も同じ扱いにする。

## 入出力

`.github/scripts/check-issue-link.sh` は環境変数 `PR_AUTHOR` と `PR_BODY` を受け取り、確認に成功すると 0、失敗すると 1 で終了する。

## エラー

Issue への参照がないときは、`::error::` の形式で原因を出力する。層の違反は Biome の診断として出力する。

## セキュリティ

PR の本文は信頼できない入力である。`${{ }}` で `run` に埋め込まず、環境変数で渡し、シェルのコードとして評価しない。ワークフローの権限は `contents: read` だけにする。

## 対象外

- Issue が実在するかの確認
- `components` が `application` の DTO の型だけを import していることの確認。パスでは判定できないのでレビューで確認する
- IndexedDB、`process.env`、現在時刻の直接の利用の確認。import ではないのでレビューで確認する
