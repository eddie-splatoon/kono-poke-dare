import { MAX_HINTS, scoreForHint } from "@/domain/scoring/score";
import type { GameProgress } from "./game-progress";

function isHintNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_HINTS
  );
}

/** 信頼できない値を検証して、進行に変換する。不正なら null を返す。 */
export function parseGameProgress(value: unknown): GameProgress | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { status, hintNumber, score } = value as Record<string, unknown>;
  switch (status) {
    case "playing":
      return isHintNumber(hintNumber) ? { status, hintNumber } : null;
    case "won":
      return isHintNumber(hintNumber) && score === scoreForHint(hintNumber)
        ? { status, hintNumber, score: scoreForHint(hintNumber) }
        : null;
    case "lost":
      return score === 0 ? { status, score } : null;
    default:
      return null;
  }
}
