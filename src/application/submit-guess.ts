import {
  isCorrectAnswer,
  normalizeAnswer,
} from "@/domain/answer/normalize-answer";
import { answerProgress } from "@/domain/game/game-progress";
import {
  type DailyGame,
  type GameResult,
  loadQuestion,
  toGameResult,
} from "./game-view";
import type { QuestionRepository } from "./ports";

export class EmptyGuessError extends Error {
  constructor() {
    super("回答が空です");
    this.name = "EmptyGuessError";
  }
}

/** 回答を判定して、ゲームを進める。 */
export async function submitGuess(
  input: { readonly game: DailyGame; readonly guess: string },
  deps: { readonly questions: QuestionRepository },
): Promise<GameResult> {
  const { game, guess } = input;
  if (normalizeAnswer(guess) === "") {
    throw new EmptyGuessError();
  }
  const question = await loadQuestion(deps.questions, game.questionNumber);
  const isCorrect = isCorrectAnswer(guess, [
    question.name,
    ...question.aliases,
  ]);
  return toGameResult(
    { ...game, progress: answerProgress(game.progress, isCorrect) },
    question,
  );
}
