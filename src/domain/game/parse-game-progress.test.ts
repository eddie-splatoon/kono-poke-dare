import { describe, expect, it } from "vitest";
import { parseGameProgress } from "./parse-game-progress";

describe("parseGameProgress", () => {
  it.each([
    [{ status: "playing", hintNumber: 1 }],
    [{ status: "playing", hintNumber: 10 }],
    [{ status: "won", hintNumber: 1, score: 100 }],
    [{ status: "won", hintNumber: 10, score: 10 }],
    [{ status: "lost", score: 0 }],
  ])("正しい値 %j を受け入れる", (value) => {
    expect(parseGameProgress(value)).toEqual(value);
  });

  it.each([
    [{ status: "paused", hintNumber: 1 }],
    [{ hintNumber: 1 }],
    [{ status: "playing" }],
    [{ status: "playing", hintNumber: 0 }],
    [{ status: "playing", hintNumber: 11 }],
    [{ status: "playing", hintNumber: 1.5 }],
    [{ status: "playing", hintNumber: "1" }],
    [{ status: "playing", hintNumber: Number.NaN }],
    [{ status: "won", score: 100 }],
    [{ status: "won", hintNumber: 11, score: 0 }],
  ])("R-21: status や hintNumber が不正な %j を拒否する", (value) => {
    expect(parseGameProgress(value)).toBeNull();
  });

  it.each([
    [{ status: "won", hintNumber: 1, score: 90 }],
    [{ status: "won", hintNumber: 1, score: 1000000 }],
    [{ status: "won", hintNumber: 1 }],
    [{ status: "lost", score: 100 }],
    [{ status: "lost" }],
  ])("R-22: 得点が一致しない %j を拒否する", (value) => {
    expect(parseGameProgress(value)).toBeNull();
  });

  it.each([[null], [undefined], ["playing"], [1], [true], [[]]])(
    "R-23: オブジェクト以外の %j を拒否する",
    (value) => {
      expect(parseGameProgress(value)).toBeNull();
    },
  );

  it("R-24: 余分なプロパティを取り除く", () => {
    expect(
      parseGameProgress({ status: "lost", score: 0, extra: "x" }),
    ).toStrictEqual({ status: "lost", score: 0 });
    expect(
      parseGameProgress({ status: "playing", hintNumber: 2, score: 100 }),
    ).toStrictEqual({ status: "playing", hintNumber: 2 });
  });
});
