import { describe, expect, it } from "vitest";
import { MAX_HINTS, scoreForHint } from "./score";

describe("scoreForHint", () => {
  it("ヒントが進むごとに 100 から 10 ずつ下がる", () => {
    const scores = Array.from({ length: MAX_HINTS }, (_, i) =>
      scoreForHint(i + 1),
    );
    expect(scores).toEqual([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
  });

  it.each([0, 11, -1, 1.5, Number.NaN])(
    "範囲外の %s はエラーにする",
    (hint) => {
      expect(() => scoreForHint(hint)).toThrow(RangeError);
    },
  );
});
