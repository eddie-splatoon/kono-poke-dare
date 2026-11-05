import { describe, expect, it } from "vitest";
import { questionNumberForDay } from "./daily-question";

const COUNT = 1025;
const START_DAY = 20_000;

function sequence(startDay: number, length: number, count: number): number[] {
  return Array.from({ length }, (_, i) =>
    questionNumberForDay(startDay + i, count),
  );
}

describe("questionNumberForDay", () => {
  it("R-4: 同じ通算日なら同じ問題番号を返す", () => {
    expect(questionNumberForDay(START_DAY, COUNT)).toBe(
      questionNumberForDay(START_DAY, COUNT),
    );
  });

  it.each([1, 2, 5, COUNT])(
    "R-5: 問題数 %i のとき、連続する日数で全問題が 1 回ずつ出る",
    (count) => {
      const numbers = sequence(START_DAY, count, count);
      const expected = Array.from({ length: count }, (_, i) => i + 1);
      expect([...numbers].sort((a, b) => a - b)).toEqual(expected);
    },
  );

  it("R-6: 問題数の日数後には同じ順序を繰り返す", () => {
    expect(sequence(START_DAY + COUNT, COUNT, COUNT)).toEqual(
      sequence(START_DAY, COUNT, COUNT),
    );
  });

  it("R-7: 出題順は図鑑番号の順にならない", () => {
    const numbers = sequence(0, COUNT, COUNT);
    const expected = Array.from({ length: COUNT }, (_, i) => i + 1);
    expect(numbers).not.toEqual(expected);
  });

  it("R-39: 出題順が変わっていない", () => {
    expect(sequence(0, 5, COUNT)).toEqual([289, 760, 111, 551, 34]);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "R-8: 問題数 %s はエラーにする",
    (count) => {
      expect(() => questionNumberForDay(START_DAY, count)).toThrow(RangeError);
    },
  );

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "R-9: 通算日 %s はエラーにする",
    (day) => {
      expect(() => questionNumberForDay(day, COUNT)).toThrow(RangeError);
    },
  );
});
