---
title: ゲーム画面
status: implemented
issues: [12, 17]
code:
  - src/application/game-session.ts
  - src/composition/create-game-session.ts
  - src/components/game-screen.tsx
  - src/components/hint-list.tsx
  - src/components/guess-form.tsx
  - src/components/game-result.tsx
  - src/app/game-client.tsx
  - src/app/page.tsx
  - next.config.ts
  - scripts/serve-export.mts
tests:
  - src/application/game-session.test.ts
  - e2e/game.spec.ts
  - e2e/base-path.spec.ts
updated: 2026-11-06
---

# ゲーム画面

## 概要

1 日 1 問のゲームを遊ぶ画面である。ヒントの表示、回答、次のヒントへ進む操作、結果の表示を、スマートフォンでも行えるようにする。ゲームのルールと保存は内側の層に任せて、画面には持たせない。

## 要件

| ID   | 要件                                                                                     |
| ---- | ---------------------------------------------------------------------------------------- |
| R-1  | 開くと、ヒント 1 と「ヒント 1 / 10」を表示する                                           |
| R-2  | 未公開のヒントを DOM に含めない                                                          |
| R-3  | 回答前の正解を DOM に含めない                                                            |
| R-4  | 正解すると、結果を表示する                                                               |
| R-5  | 不正解なら、入力欄を空にして、次のヒントと不正解の通知を表示する                         |
| R-6  | 空の回答では、ヒントを進めずに案内を表示する                                             |
| R-7  | 「次のヒントへ」で、次のヒントを表示する                                                 |
| R-8  | ヒント 10 では、次へ進むボタンの文言を「あきらめる」にする                               |
| R-9  | 次へ進むボタンを二重クリックしても、ヒントは 1 つだけ進む                                |
| R-10 | ヒント 10 を過ぎると、0 点の結果と正解を表示する                                         |
| R-11 | 結果には、得点、正解、累積スコア、見たヒントを表示し、入力欄を表示しない                 |
| R-12 | 再読み込みしても、進行を保つ                                                             |
| R-13 | 遊び終えた日に開くと、結果を表示する                                                     |
| R-14 | 翌日に開くと新しいゲームになり、終えると累積スコアに加算する                             |
| R-15 | 問題データを取得できなければ案内を表示し、「もう一度試す」で再開できる                   |
| R-16 | 記録を保存できなければ案内を表示し、ヒントを進めない                                     |
| R-17 | 幅 360px で横スクロールが出ない                                                          |
| R-18 | 操作部品の高さは 44px 以上で、入力欄の文字は 16px 以上である                             |
| R-19 | `basePath` の配下で、すべてのリソースを取得して配信データで遊べる                        |
| R-20 | セッションの操作は、成功すると `ok: true` と `game`、`view` を返す                       |
| R-21 | 進行中の `totalScore` は `null` で、集計しない                                           |
| R-22 | 終了したゲームの `totalScore` は、そのゲームを含む累積スコアである                       |
| R-23 | 集計に失敗しても、`ok: true` で `totalScore` を `null` にする                            |
| R-24 | `EmptyGuessError` は、`kind` が `empty-guess` の失敗にする                               |
| R-25 | `RecordStorageError` は、`kind` が `storage` の失敗にする                                |
| R-26 | その他の例外は、`kind` が `unavailable` の失敗にして、元の例外を `cause` に入れる        |

## ドメインルール

- 不正解とスキップの判定、得点、累積スコアは、内側の層(`game-rules.md`、`records.md`)が決める。画面は `GameView` と `totalScore` を表示するだけである
- 累積スコアは結果の画面にだけ表示する。集計できないときは、その旨を表示して、結果の表示は止めない
- 処理中は操作のボタンを無効にして、ハンドラでも再入を防ぐ。誤ってヒントを進めると得点が下がるためである
- 回答は素の `<form>` の送信で受け取る。`keydown` を扱わないので、日本語入力の確定の Enter では送信されない
- 処理に失敗しても、手元のゲームの状態を変えない。もう一度操作すれば続けられる

## 入出力

### セッション

`createGameSession` は、ユースケースを画面向けにまとめた `GameSession` を返す。

| メソッド            | 入力                 | 出力                |
| ------------------- | -------------------- | ------------------- |
| `start()`           | なし                 | `GameSessionResult` |
| `guess(game, text)` | `DailyGame`、`string` | `GameSessionResult` |
| `skip(game)`        | `DailyGame`          | `GameSessionResult` |

`GameSessionResult` は次のいずれかである。

| `ok`    | 項目                                 | 内容                                                       |
| ------- | ------------------------------------ | ---------------------------------------------------------- |
| `true`  | `game`、`view`、`totalScore`         | `totalScore` は終了後の累積スコア。進行中と集計の失敗は `null` |
| `false` | `kind`、`cause`                      | `kind` は `empty-guess`、`storage`、`unavailable` のいずれか |

### 配信

`next.config.ts` の `basePath` を `NEXT_PUBLIC_BASE_PATH` としてビルドに渡し、問題データの URL を `${basePath}/data/questions` にする。

### E2E テストの実行

`pnpm build` のあとに `pnpm e2e` を実行する。`scripts/serve-export.mts` が `out/` を `/kono-poke-dare/` の下で配信するので、公開するものと同じ成果物を確かめられる。

## エラー

| `kind`        | 条件                                       | 表示                                     |
| ------------- | ------------------------------------------ | ---------------------------------------- |
| `empty-guess` | 正規化して空になる回答                     | 名前の入力を促す                         |
| `storage`     | IndexedDB を使えない、書き込めない         | 記録を保存できないことと、確認する点を示す |
| `unavailable` | 問題データの取得の失敗など、それ以外の例外 | 読み込めないことを示す                   |

`empty-guess` 以外は、原因を `console.error` に出力する。開始の失敗では「もう一度試す」を表示する。

## セキュリティ

- 画面には `GameView` だけを渡す。問題データそのものを Client Component の状態に持たない
- 回答の入力とヒントの本文は、React のテキストとして表示する。`dangerouslySetInnerHTML` を使わない
- 回答の文字列を保存しない
- 同じオリジンの問題データを取得するだけで、外部へデータを送信しない
- `NEXT_PUBLIC_BASE_PATH` は公開の URL の一部で、秘密情報ではない
- `scripts/serve-export.mts` はテスト専用である。`127.0.0.1` だけで待ち受け、`out/` の外のファイルを返さない
- 配信データから正解を読めることは許容する(`security.md`)

## 対象外

- ゲームのロジック、保存の実装
- 開いたままのタブの翌日への自動更新(再読み込みで新しいゲームになる)
- タブ間の画面の同期(次の操作で保存済みの値に揃う。別のタブが先に進めていると、操作したタブの表示はまとめて進み、得点も保存済みのヒントを基準にする。`records.md` の R-10、R-11)
- 名前の入力補完
- 履歴の一覧表示
- データの扱いの説明ページ(#18)
