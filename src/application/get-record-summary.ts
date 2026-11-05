import type { GameProgress } from "@/domain/game/game-progress";
import { totalScore } from "@/domain/scoring/total-score";
import type { DailyGameRepository } from "./ports";

export type RecordHistoryItem = {
  readonly date: string;
  readonly status: GameProgress["status"];
  readonly score: number | null;
};

export type RecordSummary = {
  readonly totalScore: number;
  readonly history: readonly RecordHistoryItem[];
};

/** 記録から累積スコアと履歴を求める。 */
export async function getRecordSummary(deps: {
  readonly records: DailyGameRepository;
}): Promise<RecordSummary> {
  const games = await deps.records.list();
  return {
    totalScore: totalScore(games.map((game) => game.progress)),
    history: games
      .map(({ date, progress }) => ({
        date,
        status: progress.status,
        score: progress.status === "playing" ? null : progress.score,
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  };
}
