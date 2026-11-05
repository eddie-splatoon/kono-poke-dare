import { skipProgress } from "@/domain/game/game-progress";
import { type AdvanceGameDeps, advanceGame } from "./advance-game";
import type { DailyGame, GameResult } from "./game-view";

/** 回答せずに次のヒントへ進んで保存する。 */
export async function skipHint(
  input: { readonly game: DailyGame },
  deps: AdvanceGameDeps,
): Promise<GameResult> {
  return advanceGame(input.game, deps, skipProgress);
}
