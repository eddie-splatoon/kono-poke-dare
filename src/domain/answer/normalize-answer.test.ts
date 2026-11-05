import { describe, expect, it } from "vitest";
import { isCorrectAnswer, normalizeAnswer } from "./normalize-answer";

describe("isCorrectAnswer", () => {
  it.each([
    ["ぴかちゅう", ["ピカチュウ"]],
    ["ピカチュウ", ["ぴかちゅう"]],
    ["ゔぁ", ["ヴァ"]],
  ])("R-17: %s は %j に一致する", (input, names) => {
    expect(isCorrectAnswer(input, names)).toBe(true);
  });

  it.each([
    ["ﾋﾟｶﾁｭｳ", ["ピカチュウ"]],
    ["ポリゴン２", ["ポリゴン2"]],
    ["カビゴン", ["カビゴン"]],
    ["カビコ゛ン", ["カビゴン"]],
    ["ヒ゜カチュウ", ["ピカチュウ"]],
  ])("R-18: %s は %j に一致する", (input, names) => {
    expect(isCorrectAnswer(input, names)).toBe(true);
  });

  it.each([
    ["  ピカチュウ  ", ["ピカチュウ"]],
    ["ピカ チュウ", ["ピカチュウ"]],
    ["ピカ　チュウ", ["ピカチュウ"]],
    ["ピカチュウ\n", ["ピカチュウ"]],
  ])("R-19: %j は %j に一致する", (input, names) => {
    expect(isCorrectAnswer(input, names)).toBe(true);
  });

  it.each([
    ["カプコケコ", ["カプ・コケコ"]],
    ["カプ･コケコ", ["カプ・コケコ"]],
    ["タイプヌル", ["タイプ:ヌル"]],
    ["タイプ:ヌル", ["タイプ:ヌル"]],
  ])("R-20: %s は %j に一致する", (input, names) => {
    expect(isCorrectAnswer(input, names)).toBe(true);
  });

  it.each([
    ["ポリゴンz", ["ポリゴンZ"]],
    ["ポリゴンｚ", ["ポリゴンZ"]],
  ])("R-21: %s は %j に一致する", (input, names) => {
    expect(isCorrectAnswer(input, names)).toBe(true);
  });

  it("R-22: ♀ と ♂ は別のものとして判定する", () => {
    expect(isCorrectAnswer("ニドラン♀", ["ニドラン♀"])).toBe(true);
    expect(isCorrectAnswer("ニドラン♂", ["ニドラン♀"])).toBe(false);
    expect(isCorrectAnswer("ニドラン", ["ニドラン♀"])).toBe(false);
  });

  it("R-23: 別名のいずれかに一致すれば正解とする", () => {
    const names = ["ニドラン♀", "ニドランメス"];
    expect(isCorrectAnswer("にどらんめす", names)).toBe(true);
  });

  it.each(["ライチュウ", "ピカチュ", "ピカチュウピカチュウ"])(
    "R-24: %s は不正解とする",
    (input) => {
      expect(isCorrectAnswer(input, ["ピカチュウ"])).toBe(false);
    },
  );

  it.each(["", " ", "　\n", "・", ":"])(
    "R-25: 正規化して空になる %j はどの名前にも一致しない",
    (input) => {
      expect(normalizeAnswer(input)).toBe("");
      expect(isCorrectAnswer(input, ["ピカチュウ", "・"])).toBe(false);
    },
  );
});
