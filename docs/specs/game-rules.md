---
title: 出題、進行、回答判定
status: implemented
issues: [12, 13, 14]
code:
  - src/domain/calendar/jst-date.ts
  - src/domain/schedule/daily-question.ts
  - src/domain/answer/normalize-answer.ts
  - src/domain/game/game-progress.ts
  - src/domain/game/question.ts
  - src/application/ports.ts
  - src/application/game-view.ts
  - src/application/start-daily-game.ts
  - src/application/submit-guess.ts
  - src/application/skip-hint.ts
tests:
  - src/domain/calendar/jst-date.test.ts
  - src/domain/schedule/daily-question.test.ts
  - src/domain/answer/normalize-answer.test.ts
  - src/domain/game/game-progress.test.ts
  - src/application/game-use-cases.test.ts
updated: 2026-11-05
---

# 出題、進行、回答判定

## 概要

1 日 1 問、ヒント 10 個で当てるゲームのルールを、画面と保存方法に依存しない形で定める。JST の日付から問題を決め、回答とヒントの進行を判定して、得点を決める。

## 要件

| ID   | 要件                                                                                         |
| ---- | -------------------------------------------------------------------------------------------- |
| R-1  | 時刻から JST の日付を `YYYY-MM-DD` で返す                                                    |
| R-2  | JST の 0 時(UTC の 15 時)で日付が切り替わる                                                  |
| R-3  | 不正な `Date` は `RangeError` にする                                                         |
| R-4  | 同じ通算日なら同じ問題番号を返す                                                             |
| R-5  | 問題数 N のとき、連続する N 日で 1〜N の問題が 1 回ずつ出る                                  |
| R-6  | N 日後には同じ問題に戻り、同じ順序を繰り返す                                                 |
| R-7  | 出題順は図鑑番号の順にならない                                                               |
| R-8  | 問題数が 1 以上の整数でなければ `RangeError` にする                                          |
| R-9  | 通算日が整数でなければ `RangeError` にする                                                   |
| R-10 | ゲームはヒント 1 の `playing` で始まる                                                       |
| R-11 | 不正解なら次のヒントへ進む                                                                   |
| R-12 | 回答せずに次へ進むと、次のヒントへ進む                                                       |
| R-13 | 正解なら、そのヒント番号の得点(`scoreForHint`)で `won` になる                                |
| R-14 | ヒント 10 で不正解なら、0 点の `lost` になる                                                 |
| R-15 | ヒント 10 で次へ進むと、0 点の `lost` になる                                                 |
| R-16 | 終了したゲームを操作すると `GameFinishedError` にする                                        |
| R-17 | ひらがなとカタカナの違いを同じものとして判定する                                             |
| R-18 | 半角カナ、全角英数字、濁点と半濁点の分離形を同じものとして判定する                           |
| R-19 | 前後と途中の空白を無視して判定する                                                           |
| R-20 | 中黒とコロンを無視して判定する                                                               |
| R-21 | 英字の大文字と小文字を同じものとして判定する                                                 |
| R-22 | `♀` と `♂` は別のものとして判定する                                                          |
| R-23 | 別名のいずれかに一致すれば正解とする                                                         |
| R-24 | どの名前にも一致しなければ不正解とする                                                       |
| R-25 | 正規化して空になる回答は、どの名前にも一致しない                                             |
| R-26 | ゲームの開始時に、現在時刻の JST の日付と、その日の問題番号、ヒント 1 を返す                 |
| R-27 | 同じ JST の日付なら、時刻が違っても同じ問題になる                                            |
| R-28 | JST の 0 時をまたぐと、別の問題になる                                                        |
| R-29 | 回答のユースケースは、正解なら `won` と得点を返す                                            |
| R-30 | 回答のユースケースは、不正解なら次のヒントを返す                                             |
| R-31 | 空の回答は `EmptyGuessError` にして、ヒントを進めない                                       |
| R-32 | 次へ進むユースケースは、次のヒントを返す                                                     |
| R-33 | ビューの `visibleHints` は、現在のヒントまでだけを含む                                       |
| R-34 | ゲームの進行中は、ビューの `answer` を `null` にする                                         |
| R-35 | ゲームが終了したら、ビューの `answer` に正解の名前を入れる                                   |
| R-36 | 進行中のゲームは、JST の 0 時をまたいでも、開始した日の問題のまま続く                        |
| R-37 | 問題が見つからなければ `QuestionNotFoundError` にする                                        |
| R-38 | 終了したゲームにユースケースで回答や次へ進む操作をすると `GameFinishedError` にする          |
| R-39 | 問題数 1025 の通算日 0〜4 の問題番号は、順に 289、760、111、551、34 である(出題順を固定する) |

## ドメインルール

- 日付の区切りは JST とする。JST は夏時間がないので、UTC に 9 時間を足して求める。実行環境のタイムゾーンに依存しない
- 通算日は、JST の日付で 1970-01-01 を 0 とする日数である
- 出題順は、固定シードの疑似乱数で問題番号をシャッフルした順列である。通算日を問題数で割った余りを、順列の位置として使う
- 一巡したあとは、同じ順序を繰り返す(#12 の未確定事項に対する、この仕様の決定)
- ゲームの状態は `playing`、`won`、`lost` のいずれかで、`won` と `lost` は終了状態である
- 得点は `scoreForHint`(`docs/specs/scoring.md`)で決める。当てられなければ 0 点である
- 姿違いの名前を正解にするかどうかは、ロジックでは決めない。問題データの `aliases` に入っている名前を正解とする(`docs/specs/quiz-data.md`)

### 回答の正規化

次の順に変換してから、完全一致で比較する。

1. NFKC で正規化する
2. 空白、`・`、`:` を取り除き、もう一度 NFKC で正規化する(濁点の単独文字を前の文字と合成するため)
3. ひらがなをカタカナにする(`ゔ` は `ヴ` にする)
4. 英字を小文字にする

### 既知の制約

問題数が変わると、順列が変わる。進行中のゲームは問題番号を持つので影響を受けないが、配信データが更新された日は、更新の前後で始めた人の問題が異なることがある。

## 入出力

| ユースケース     | 入力                                                                            | 出力             |
| ---------------- | ------------------------------------------------------------------------------- | ---------------- |
| `startDailyGame` | `Clock`、`QuestionRepository`、`DailyGameRepository`                            | `{ game, view }` |
| `submitGuess`    | `game`、`guess`、`QuestionRepository`、`DailyGameRepository`、`StoragePersistence` | `{ game, view }` |
| `skipHint`       | `game`、`QuestionRepository`、`DailyGameRepository`、`StoragePersistence`        | `{ game, view }` |

保存と再開の振る舞いは `records.md` で定める。

`game`(`DailyGame`)はシリアライズできる値で、次の項目を持つ。

| 項目             | 型             | 範囲                     |
| ---------------- | -------------- | ------------------------ |
| `date`           | `string`       | `YYYY-MM-DD`(JST)        |
| `questionNumber` | `number`       | 1〜問題数の整数          |
| `progress`       | `GameProgress` | 進行の状態               |

`view`(`GameView`)は画面に渡す値で、次の項目を持つ。

| 項目           | 型                            | 内容                                   |
| -------------- | ----------------------------- | -------------------------------------- |
| `date`         | `string`                      | `YYYY-MM-DD`(JST)                      |
| `status`       | `playing`、`won`、`lost`      | 進行の状態                             |
| `hintNumber`   | `number`                      | 現在のヒント番号。`lost` では 10       |
| `visibleHints` | `readonly string[]`           | 現在のヒントまでの本文                 |
| `score`        | `number`、`null`              | 終了後の得点。進行中は `null`          |
| `answer`       | `string`、`null`              | 終了後の正解の名前。進行中は `null`    |

## エラー

| エラー                  | 条件                                         |
| ----------------------- | -------------------------------------------- |
| `RangeError`            | 不正な `Date`、問題数、通算日                |
| `GameFinishedError`     | 終了したゲームへの操作                       |
| `EmptyGuessError`       | 正規化して空になる回答                       |
| `QuestionNotFoundError` | 問題番号に対応する問題がない                 |

いずれの場合も、ゲームの状態を進めない。

## セキュリティ

- 回答の入力を信頼しない。文字列として正規化して比較するだけで、評価や HTML への埋め込みをしない
- `GameView` に未公開のヒントと回答前の正解を含めない。正解データが配信データに含まれることは許容する(`security.md`)
- 外部へデータを送信しない。保存はポートを通して行い、保存値の検証は `records.md` で定める

## 対象外

- 保存、再開するゲームの選択(`records.md`)
- 問題データの形式の検証(`docs/specs/quiz-data.md`)と中身(#16)
- 画面(#17)
