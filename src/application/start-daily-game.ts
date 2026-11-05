import { jstDateKey, jstDayNumber } from "@/domain/calendar/jst-date";
import { startProgress } from "@/domain/game/game-progress";
import { questionNumberForDay } from "@/domain/schedule/daily-question";
import { type GameResult, loadQuestion, toGameResult } from "./game-view";
import type { Clock, QuestionRepository } from "./ports";

/** 現在時刻の JST の日付から問題を決めて、ゲームを始める。 */
export async function startDailyGame(deps: {
  readonly clock: Clock;
  readonly questions: QuestionRepository;
}): Promise<GameResult> {
  const now = deps.clock.now();
  const questionNumber = questionNumberForDay(
    jstDayNumber(now),
    await deps.questions.count(),
  );
  const question = await loadQuestion(deps.questions, questionNumber);
  return toGameResult(
    { date: jstDateKey(now), questionNumber, progress: startProgress() },
    question,
  );
}
