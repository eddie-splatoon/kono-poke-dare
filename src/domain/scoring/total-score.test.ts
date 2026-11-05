import { describe, expect, it } from "vitest";
import { totalScore } from "./total-score";

describe("totalScore", () => {
  it("R-14: 終了したゲームの得点を合計する", () => {
    expect(
      totalScore([
        { status: "won", hintNumber: 1, score: 100 },
        { status: "won", hintNumber: 3, score: 80 },
        { status: "lost", score: 0 },
      ]),
    ).toBe(180);
  });

  it("R-15: 進行中のゲームは加算しない", () => {
    expect(
      totalScore([
        { status: "won", hintNumber: 2, score: 90 },
        { status: "playing", hintNumber: 5 },
      ]),
    ).toBe(90);
  });

  it("R-17: 記録がなければ 0 を返す", () => {
    expect(totalScore([])).toBe(0);
  });
});
