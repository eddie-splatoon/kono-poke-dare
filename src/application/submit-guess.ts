import {
  isCorrectAnswer,
  normalizeAnswer,
} from "@/domain/answer/normalize-answer";
import { answerProgress } from "@/domain/game/game-progress";
import { type AdvanceGameDeps, advanceGame } from "./advance-game";
import type { DailyGame, GameResult } from "./game-view";

export class EmptyGuessError extends Error {
  constructor() {
    super("回答が空です");
    this.name = "EmptyGuessError";
  }
}

/** 回答を判定して、ゲームを進めて保存する。 */
export async function submitGuess(
  input: { readonly game: DailyGame; readonly guess: string },
  deps: AdvanceGameDeps,
): Promise<GameResult> {
  const { game, guess } = input;
  if (normalizeAnswer(guess) === "") {
    throw new EmptyGuessError();
  }
  return advanceGame(game, deps, (progress, question) =>
    answerProgress(
      progress,
      isCorrectAnswer(guess, [question.name, ...question.aliases]),
    ),
  );
}
