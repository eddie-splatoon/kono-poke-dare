import type { GameProgress } from "@/domain/game/game-progress";
import type { Question } from "@/domain/game/question";
import { MAX_HINTS } from "@/domain/scoring/score";
import type { QuestionRepository } from "./ports";

/** 1 日分のゲームの状態。シリアライズして保存できる。 */
export type DailyGame = {
  readonly date: string;
  readonly questionNumber: number;
  readonly progress: GameProgress;
};

/** 画面に渡す値。未公開のヒントと回答前の正解を含めない。 */
export type GameView = {
  readonly date: string;
  readonly status: GameProgress["status"];
  readonly hintNumber: number;
  readonly maxHints: number;
  readonly visibleHints: readonly string[];
  readonly score: number | null;
  readonly answer: string | null;
};

export type GameResult = {
  readonly game: DailyGame;
  readonly view: GameView;
};

export class QuestionNotFoundError extends Error {
  constructor(questionNumber: number) {
    super(`問題が見つかりません: ${questionNumber}`);
    this.name = "QuestionNotFoundError";
  }
}

export async function loadQuestion(
  questions: QuestionRepository,
  questionNumber: number,
): Promise<Question> {
  const question = await questions.findByNumber(questionNumber);
  if (question === null) {
    throw new QuestionNotFoundError(questionNumber);
  }
  return question;
}

export function toGameResult(game: DailyGame, question: Question): GameResult {
  const { progress } = game;
  const hintNumber =
    progress.status === "lost" ? MAX_HINTS : progress.hintNumber;
  const isPlaying = progress.status === "playing";
  return {
    game,
    view: {
      date: game.date,
      status: progress.status,
      hintNumber,
      maxHints: MAX_HINTS,
      visibleHints: question.hints.slice(0, hintNumber),
      score: isPlaying ? null : progress.score,
      answer: isPlaying ? null : question.name,
    },
  };
}
