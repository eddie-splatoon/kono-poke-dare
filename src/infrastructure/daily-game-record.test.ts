import { describe, expect, it } from "vitest";
import { parseDailyGameRecord } from "./daily-game-record";

const valid = {
  date: "2026-11-05",
  questionNumber: 3,
  progress: { status: "playing", hintNumber: 2 },
};

describe("parseDailyGameRecord", () => {
  it("正しい値を受け入れる", () => {
    expect(parseDailyGameRecord(valid)).toEqual(valid);
  });

  it.each(["2026-02-30", "x", 20261105, null])(
    "R-19: date が %j なら null を返す",
    (date) => {
      expect(parseDailyGameRecord({ ...valid, date })).toBeNull();
    },
  );

  it.each([0, -1, 1.5, "3", null, Number.POSITIVE_INFINITY])(
    "R-20: questionNumber が %j なら null を返す",
    (questionNumber) => {
      expect(parseDailyGameRecord({ ...valid, questionNumber })).toBeNull();
    },
  );

  it("R-21: progress が不正なら null を返す", () => {
    expect(
      parseDailyGameRecord({
        ...valid,
        progress: { status: "playing", hintNumber: 99 },
      }),
    ).toBeNull();
  });

  it("R-22: won の得点が一致しなければ null を返す", () => {
    expect(
      parseDailyGameRecord({
        ...valid,
        progress: { status: "won", hintNumber: 5, score: 100 },
      }),
    ).toBeNull();
  });

  it.each([[null], [undefined], ["x"], [1], [[]]])(
    "R-23: オブジェクト以外の %j なら null を返す",
    (value) => {
      expect(parseDailyGameRecord(value)).toBeNull();
    },
  );

  it("R-24: 余分なプロパティを取り除く", () => {
    expect(parseDailyGameRecord({ ...valid, extra: "x" })).toStrictEqual(valid);
  });
});
