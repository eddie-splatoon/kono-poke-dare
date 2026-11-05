import { describe, expect, it } from "vitest";
import { MAX_HINTS, scoreForHint } from "@/domain/scoring/score";
import {
  answerProgress,
  GameFinishedError,
  type GameProgress,
  skipProgress,
  startProgress,
} from "./game-progress";

const playingAt = (hintNumber: number): GameProgress => ({
  status: "playing",
  hintNumber,
});

const hintNumbers = Array.from({ length: MAX_HINTS }, (_, i) => i + 1);
const beforeLastHint = hintNumbers.slice(0, -1);

describe("startProgress", () => {
  it("R-10: ヒント 1 の playing で始まる", () => {
    expect(startProgress()).toEqual({ status: "playing", hintNumber: 1 });
  });
});

describe("answerProgress", () => {
  it.each(beforeLastHint)("R-11: ヒント %i で不正解なら次へ進む", (hint) => {
    expect(answerProgress(playingAt(hint), false)).toEqual(playingAt(hint + 1));
  });

  it.each(hintNumbers)("R-13: ヒント %i で正解なら得点を得て終わる", (hint) => {
    expect(answerProgress(playingAt(hint), true)).toEqual({
      status: "won",
      hintNumber: hint,
      score: scoreForHint(hint),
    });
  });

  it("R-14: ヒント 10 で不正解なら 0 点で終わる", () => {
    expect(answerProgress(playingAt(MAX_HINTS), false)).toEqual({
      status: "lost",
      score: 0,
    });
  });
});

describe("skipProgress", () => {
  it.each(beforeLastHint)("R-12: ヒント %i から次へ進む", (hint) => {
    expect(skipProgress(playingAt(hint))).toEqual(playingAt(hint + 1));
  });

  it("R-15: ヒント 10 で次へ進むと 0 点で終わる", () => {
    expect(skipProgress(playingAt(MAX_HINTS))).toEqual({
      status: "lost",
      score: 0,
    });
  });
});

describe("終了したゲーム", () => {
  const finished: GameProgress[] = [
    { status: "won", hintNumber: 3, score: 80 },
    { status: "lost", score: 0 },
  ];

  it.each(finished)("R-16: $status のゲームは操作できない", (progress) => {
    expect(() => answerProgress(progress, true)).toThrow(GameFinishedError);
    expect(() => answerProgress(progress, false)).toThrow(GameFinishedError);
    expect(() => skipProgress(progress)).toThrow(GameFinishedError);
  });
});
