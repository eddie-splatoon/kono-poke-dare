import type { DailyGame } from "@/application/game-view";
import { isDateKey } from "@/domain/calendar/date-key";
import { parseGameProgress } from "@/domain/game/parse-game-progress";

/** IndexedDB から読んだ値を検証する。不正なら null を返す。 */
export function parseDailyGameRecord(value: unknown): DailyGame | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { date, questionNumber, progress } = value as Record<string, unknown>;
  if (
    !isDateKey(date) ||
    typeof questionNumber !== "number" ||
    !Number.isInteger(questionNumber) ||
    questionNumber < 1
  ) {
    return null;
  }
  const parsedProgress = parseGameProgress(progress);
  return parsedProgress === null
    ? null
    : { date, questionNumber, progress: parsedProgress };
}
