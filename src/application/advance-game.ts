import {
  GameFinishedError,
  type GameProgress,
} from "@/domain/game/game-progress";
import type { Question } from "@/domain/game/question";
import {
  type DailyGame,
  type GameResult,
  loadQuestion,
  toGameResult,
} from "./game-view";
import type {
  DailyGameRepository,
  QuestionRepository,
  StoragePersistence,
} from "./ports";

export type AdvanceGameDeps = {
  readonly questions: QuestionRepository;
  readonly records: DailyGameRepository;
  readonly persistence: StoragePersistence;
};

/**
 * 保存済みの最新の進行に操作を適用して保存する。
 * 別のタブが先に進めていても、手元の古い値で上書きしない。
 */
export async function advanceGame(
  game: DailyGame,
  deps: AdvanceGameDeps,
  step: (progress: GameProgress, question: Question) => GameProgress,
): Promise<GameResult> {
  if (game.progress.status !== "playing") {
    throw new GameFinishedError();
  }
  const question = await loadQuestion(deps.questions, game.questionNumber);

  const saved = await deps.records.update(game.date, (stored) => {
    const latest = stored ?? game;
    if (
      latest.questionNumber !== game.questionNumber ||
      latest.progress.status !== "playing"
    ) {
      return latest;
    }
    return { ...latest, progress: step(latest.progress, question) };
  });

  if (saved.progress.status !== "playing") {
    // ブラウザの確認を待たない。request は reject しない。
    void deps.persistence.request();
  }
  return toGameResult(
    saved,
    saved.questionNumber === question.number
      ? question
      : await loadQuestion(deps.questions, saved.questionNumber),
  );
}
