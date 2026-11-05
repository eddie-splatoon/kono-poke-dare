import type { AdvanceGameDeps } from "./advance-game";
import type { DailyGame, GameResult, GameView } from "./game-view";
import { getRecordSummary } from "./get-record-summary";
import { type Clock, RecordStorageError } from "./ports";
import { skipHint } from "./skip-hint";
import { startDailyGame } from "./start-daily-game";
import { EmptyGuessError, submitGuess } from "./submit-guess";

export type GameFailureKind = "empty-guess" | "storage" | "unavailable";

export type GameSessionResult =
  | {
      readonly ok: true;
      readonly game: DailyGame;
      readonly view: GameView;
      /** 終了後の累積スコア。進行中と集計の失敗では null。 */
      readonly totalScore: number | null;
    }
  | {
      readonly ok: false;
      readonly kind: GameFailureKind;
      readonly cause: unknown;
    };

/** 画面から呼び出す操作。例外を投げず、失敗を値で返す。 */
export type GameSession = {
  start(): Promise<GameSessionResult>;
  guess(game: DailyGame, text: string): Promise<GameSessionResult>;
  skip(game: DailyGame): Promise<GameSessionResult>;
};

function failureKind(error: unknown): GameFailureKind {
  if (error instanceof EmptyGuessError) {
    return "empty-guess";
  }
  return error instanceof RecordStorageError ? "storage" : "unavailable";
}

export function createGameSession(
  deps: AdvanceGameDeps & { readonly clock: Clock },
): GameSession {
  async function totalScoreOf(view: GameView): Promise<number | null> {
    if (view.status === "playing") {
      return null;
    }
    try {
      return (await getRecordSummary(deps)).totalScore;
    } catch {
      // 結果はすでに保存できているので、集計の失敗で結果の表示を止めない。
      return null;
    }
  }

  async function run(
    operation: () => Promise<GameResult>,
  ): Promise<GameSessionResult> {
    try {
      const { game, view } = await operation();
      return { ok: true, game, view, totalScore: await totalScoreOf(view) };
    } catch (cause) {
      return { ok: false, kind: failureKind(cause), cause };
    }
  }

  return {
    start: () => run(() => startDailyGame(deps)),
    guess: (game, text) => run(() => submitGuess({ game, guess: text }, deps)),
    skip: (game) => run(() => skipHint({ game }, deps)),
  };
}
