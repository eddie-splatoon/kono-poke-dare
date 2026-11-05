# このポケだーれ?

10 個のヒントでポケモンを当てる、1 日 1 回のゲームです。ヒントはだんだん易しくなり、早く当てるほど高得点(100 → 90 → … → 10)になります。スコアは累積します。

名前は「このポケモン、だーれだ?」という問いかけから付けました。

> 非公式のファン作品です。任天堂、株式会社ポケモン、その他の権利者とは関係ありません。公式の画像、ロゴ、音声は使用しません。収益化はしていません。権利者の方からのご連絡は、[Issue](https://github.com/eddie-splatoon/kono-poke-dare/issues) で受け付けます。申し立てがあれば、公開を停止します。

公開先: https://eddie-splatoon.github.io/kono-poke-dare/

## 開発

Node.js 24 と pnpm 10 が必要です。

```sh
pnpm install
pnpm dev
```

| コマンド         | 内容                                   |
| ---------------- | -------------------------------------- |
| `pnpm lint`      | Biome による lint とフォーマットの確認 |
| `pnpm typecheck` | 型チェック                             |
| `pnpm test`      | Vitest によるテスト                    |
| `pnpm build`     | 本番ビルド                             |
| `pnpm e2e`       | `out/` に対する Playwright のテスト    |

ブランチごとに Git worktree を作って開発します。

```sh
scripts/worktree.sh new feat/some-thing  # .claude/worktrees/ に作り、依存をインストールする
scripts/worktree.sh clean                # PR がマージ済みの worktree を削除する
```

コーディング規約は [`.claude/skills/coding-standards/`](.claude/skills/coding-standards/SKILL.md)、機能仕様は [`docs/specs/`](docs/specs/README.md) にあります。脆弱性の報告は [`SECURITY.md`](SECURITY.md) を参照してください。
