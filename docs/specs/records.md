---
title: 記録の保存
status: implemented
issues: [12, 14]
code:
  - src/domain/calendar/date-key.ts
  - src/domain/game/parse-game-progress.ts
  - src/domain/scoring/total-score.ts
  - src/application/ports.ts
  - src/application/advance-game.ts
  - src/application/start-daily-game.ts
  - src/application/submit-guess.ts
  - src/application/skip-hint.ts
  - src/application/get-record-summary.ts
  - src/infrastructure/daily-game-record.ts
  - src/infrastructure/indexed-db-daily-game-repository.ts
  - src/infrastructure/navigator-storage-persistence.ts
tests:
  - src/domain/calendar/date-key.test.ts
  - src/domain/game/parse-game-progress.test.ts
  - src/domain/scoring/total-score.test.ts
  - src/application/record-use-cases.test.ts
  - src/infrastructure/daily-game-record.test.ts
  - src/infrastructure/indexed-db-daily-game-repository.test.ts
  - src/infrastructure/navigator-storage-persistence.test.ts
updated: 2026-11-05
---

# 記録の保存

## 概要

ゲームの進行、履歴、累積スコアを端末内の IndexedDB に保存する。再読み込みしても続きから遊べて、複数のタブで開いても同じ日の得点が二重に加算されないようにする。

## 要件

| ID   | 要件                                                                                   |
| ---- | -------------------------------------------------------------------------------------- |
| R-1  | 同じ日にもう一度開始すると、保存済みの進行を返す                                       |
| R-2  | 開始した時点で、その日の記録を保存する                                                 |
| R-3  | 別の日に開始すると新しいゲームになり、前の日の記録は残る                               |
| R-4  | 保存された問題番号の問題がなければ、その日の記録を新しいゲームで置き換える             |
| R-5  | 回答の結果を保存する                                                                   |
| R-6  | 次へ進む操作の結果を保存する                                                           |
| R-7  | 0 時をまたいだゲームは、開始した日の記録に保存し、次の日の記録を変えない               |
| R-8  | 接続を作り直しても、進行と累積スコアが保たれる                                         |
| R-9  | 複数のタブで同時に開始しても、記録は 1 件で、同じゲームになる                          |
| R-10 | 別のタブが先に終えていたら、操作を捨てて、保存済みの結果を返す                         |
| R-11 | 古いタブの操作は、保存済みの最新のヒントを基準にする                                   |
| R-12 | 複数のタブで同時に操作しても、どの操作も失われない                                     |
| R-13 | 保存済みの問題番号が手元と異なれば、操作を捨てて、保存済みの値とその問題を返す         |
| R-14 | 累積スコアは、終了したゲームの得点の合計である                                         |
| R-15 | 進行中のゲームは、累積スコアに加算しない                                               |
| R-16 | 同じ日のゲームを複数のタブで終えても、累積スコアには 1 回分だけ加算する                |
| R-17 | 記録がなければ、累積スコアは 0 である                                                  |
| R-18 | 履歴は日付の新しい順で、`date`、`status`、`score` だけを持つ。進行中の `score` は `null` である |
| R-19 | `date` が実在する `YYYY-MM-DD` でない値は、不正として `null` にする                    |
| R-20 | `questionNumber` が 1 以上の整数でない値は、不正として `null` にする                   |
| R-21 | `progress` の `status` と `hintNumber` が範囲外の値は、不正として `null` にする        |
| R-22 | `won` の `score` がヒント番号の得点と異なる値と、`lost` の `score` が 0 でない値は、不正として `null` にする |
| R-23 | オブジェクト以外の値は、不正として `null` にする                                       |
| R-24 | 検証を通った値から、余分なプロパティを取り除く                                         |
| R-25 | 一覧は不正なレコードを除外し、例外にしない                                             |
| R-26 | 不正なレコードは、なかったものとして `update` の `change` に渡す                       |
| R-27 | `change` が例外を投げたら、書き込まずに、その例外で reject する                        |
| R-28 | IndexedDB を使えないときは、`RecordStorageError` で reject する                        |
| R-29 | 保存に失敗したら、ゲームの状態を進めない                                               |
| R-30 | 操作の結果が終了のときに、永続化を要求する                                             |
| R-31 | 操作の結果が進行中のときと、開始のときは、永続化を要求しない                           |
| R-32 | 永続化の API が未対応か失敗したときは、`false` を返し、reject しない                   |

## ドメインルール

- 記録は 1 日 1 件で、`date` をキーにする。同じ日の記録は重複しない
- 累積スコアは保存せず、記録から毎回合計する。集計値と履歴が食い違わない
- 読み込み、変更、書き込みを 1 つの `readwrite` トランザクションで行う。IndexedDB が同じ store への書き込みを直列に実行するので、タブ間で競合しない
- 操作は、手元の値ではなく保存済みの値に適用する。保存済みの値がなければ、手元の値に適用する
- 途中のまま日をまたいだゲームは、再読み込み後には再開しない。その日の新しいゲームを始める。開いたままのタブは、開始した日の記録に保存して続ける(`game-rules.md` の R-36)
- 手元のゲームがすでに終了していれば、`GameFinishedError` にする(`game-rules.md` の R-38)

### 永続化の要求

`navigator.storage.persist()` で、ブラウザがデータを消しにくくするように要求する。ブラウザが確認を出すことがあるので、ページを開いた時点では呼ばず、ゲームが終了したときに呼ぶ。結果は待たず、結果によってゲームの動作を変えない。

## 入出力

### 保存するデータ

DB `kono-poke-dare`(version 1)の object store `dailyGames`(`keyPath: "date"`)に、`DailyGame` を保存する。

| 項目             | 型             | 範囲                                                                                 |
| ---------------- | -------------- | ------------------------------------------------------------------------------------ |
| `date`           | `string`       | 実在する日付の `YYYY-MM-DD`                                                          |
| `questionNumber` | `number`       | 1 以上の整数。上限は問題数に依存するので、開始時に問題の有無で確かめる               |
| `progress`       | `GameProgress` | `playing`(`hintNumber`)、`won`(`hintNumber`、`scoreForHint` と一致する `score`)、`lost`(`score` は 0) |

### ポート

| ポート                | メソッド                 | 内容                                                       |
| --------------------- | ------------------------ | ---------------------------------------------------------- |
| `DailyGameRepository` | `update(date, change)`   | 保存値(不正なら `null`)を `change` に渡し、結果を保存して返す |
| `DailyGameRepository` | `list()`                 | 検証を通った記録を返す                                     |
| `StoragePersistence`  | `request()`              | 永続化を要求する。`boolean` を返し、reject しない          |

`change` は同期関数である。トランザクションの中で別の非同期処理を待つと、トランザクションが自動で完了するためである。

### ユースケース

| ユースケース       | 入力                      | 出力                     |
| ------------------ | ------------------------- | ------------------------ |
| `getRecordSummary` | `DailyGameRepository`     | `{ totalScore, history }` |

## エラー

| エラー               | 条件                                                                 | 振る舞い                                   |
| -------------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| `RecordStorageError` | IndexedDB を開けない、書き込めない(容量不足を含む)                  | ユースケースからそのまま伝え、状態を進めない。表示は #17 で扱う |
| なし                 | 保存値が不正である                                                   | なかったものとして扱う                     |

ゲームの途中で保存値の問題番号が存在しない番号に書き換えられたときは、`QuestionNotFoundError` になる。次の開始で R-4 により回復する。

## セキュリティ

- IndexedDB の値は利用者が書き換えられるので、内側へ渡す前に型と範囲を検証する
- 不正なレコードは削除しない。一覧から除外し、同じ日の保存で上書きされる
- 検証を通る範囲の書き換え(過去の日付の記録を足して累積スコアを増やすなど)は防げない。ランキングがなく、影響は本人の端末に閉じるので許容する
- 保存するのは日付、問題番号、進行だけである。回答の文字列は保存しない
- 外部へデータを送信しない

## 対象外

- 端末間の引き継ぎ、外部への送信
- 保存せずに遊ばせるモード
- 依存の組み立てと画面(#17)
