import type { GameProgress } from "@/domain/game/game-progress";

/** 終了したゲームの得点を合計する。進行中のゲームは加算しない。 */
export function totalScore(progresses: readonly GameProgress[]): number {
  return progresses.reduce(
    (total, progress) =>
      progress.status === "playing" ? total : total + progress.score,
    0,
  );
}
