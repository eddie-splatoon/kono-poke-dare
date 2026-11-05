import { skipProgress } from "@/domain/game/game-progress";
import {
  type DailyGame,
  type GameResult,
  loadQuestion,
  toGameResult,
} from "./game-view";
import type { QuestionRepository } from "./ports";

/** 回答せずに次のヒントへ進む。 */
export async function skipHint(
  input: { readonly game: DailyGame },
  deps: { readonly questions: QuestionRepository },
): Promise<GameResult> {
  const { game } = input;
  const question = await loadQuestion(deps.questions, game.questionNumber);
  return toGameResult(
    { ...game, progress: skipProgress(game.progress) },
    question,
  );
}
