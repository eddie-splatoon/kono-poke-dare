---
name: coding-standards
description: このリポジトリ(このポケだーれ?)のコーディング規約。オニオンアーキテクチャ、TDD、セキュアコード、Issue / Sub Issue / PR のトレーサビリティ、機能仕様のドキュメント化、Git worktree を使った開発を定める。実装、設計、機能追加、バグ修正、リファクタリング、Issue の起票、PR の作成、レビューを行うときは、作業を始める前に必ずこの Skill を使う。
---

# コーディング規約

このリポジトリでの作業はすべて、この規約に従う。例外が必要なときは、理由を Issue か PR に書く。

## 作業の流れ

```text
Issue → worktree 作成 → 仕様 → Red → Green → Refactor → PR → マージ → worktree 削除
```

1. **Issue**: 対応する Issue があることを確認する。新規機能なら実装の前に起票する。大きな作業は Sub Issue に分ける
2. **worktree 作成**: `scripts/worktree.sh new <branch>` で作り、その中で作業する
3. **仕様**: `docs/specs/` の該当する仕様を読み、要件(`R-n`)を追加または更新する
4. **Red**: 要件を確かめる、失敗するテストを先に書く
5. **Green**: テストが通る最小の実装を、正しい層に書く
6. **Refactor**: テストが通る状態を保って整理する
7. **PR**: テンプレートに沿って、Issue にひも付けて作成する
8. **worktree 削除**: PR のマージ後に、親のチェックアウトで `scripts/worktree.sh clean` を実行する

## 必須ルール

| 領域         | ルール                                                                                       | 詳細                                              |
| ------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 設計         | 依存は外側から内側への一方向のみ。`domain` は外部のものに依存しない                          | [architecture.md](references/architecture.md)     |
| テスト       | 実装より先に、失敗するテストを書く。バグ修正は再現するテストから始める                       | [tdd.md](references/tdd.md)                       |
| セキュリティ | 外部へデータを送信しない。正解データは配信データに含まれるものとして扱う。入力と端末内のデータを信頼しない。秘密情報をコードやログに残さない | [security.md](references/security.md)             |
| Issue / PR   | 新規機能は実装前に起票する。PR は最低 1 つの Issue にひも付ける                              | [issues-and-prs.md](references/issues-and-prs.md) |
| 仕様         | 機能の実装や変更と同じ PR で `docs/specs/` を更新する                                        | [specs.md](references/specs.md)                   |
| worktree     | 実装開始時に worktree を作り、PR のマージ時に削除する。親のチェックアウトで直接開発しない    | [worktree.md](references/worktree.md)             |

作業に関係する reference を読んでから始める。

## 完了前のチェックリスト

- [ ] worktree の中で作業している
- [ ] PR が Issue にひも付いている
- [ ] 依存方向を守っている
- [ ] テストを先に書き、テスト名に要件 ID が入っている
- [ ] 外部へデータを送信していない。秘密情報がコード、配信データ、ログに出ていない
- [ ] `/security-review` を実行し、指摘に対応した
- [ ] `docs/specs/` の仕様と索引がコードと一致している
- [ ] 公式の画像、ロゴ、音声を追加していない
- [ ] `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build` がすべて通る
