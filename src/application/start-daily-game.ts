import { jstDateKey, jstDayNumber } from "@/domain/calendar/jst-date";
import { startProgress } from "@/domain/game/game-progress";
import { questionNumberForDay } from "@/domain/schedule/daily-question";
import {
  type DailyGame,
  type GameResult,
  loadQuestion,
  toGameResult,
} from "./game-view";
import type { Clock, DailyGameRepository, QuestionRepository } from "./ports";

/** 現在時刻の JST の日付のゲームを、保存済みなら再開し、なければ始める。 */
export async function startDailyGame(deps: {
  readonly clock: Clock;
  readonly questions: QuestionRepository;
  readonly records: DailyGameRepository;
}): Promise<GameResult> {
  const now = deps.clock.now();
  const date = jstDateKey(now);
  const newGame: DailyGame = {
    date,
    questionNumber: questionNumberForDay(
      jstDayNumber(now),
      await deps.questions.count(),
    ),
    progress: startProgress(),
  };

  const saved = await deps.records.update(date, (stored) => stored ?? newGame);
  const question = await deps.questions.findByNumber(saved.questionNumber);
  if (question !== null) {
    return toGameResult(saved, question);
  }

  // 保存された問題番号が不正なので、その日の記録を作り直す。
  const replaced = await deps.records.update(date, () => newGame);
  return toGameResult(
    replaced,
    await loadQuestion(deps.questions, replaced.questionNumber),
  );
}
