import { MAX_HINTS, scoreForHint } from "@/domain/scoring/score";

export type GameProgress =
  | { readonly status: "playing"; readonly hintNumber: number }
  | {
      readonly status: "won";
      readonly hintNumber: number;
      readonly score: number;
    }
  | { readonly status: "lost"; readonly score: 0 };

export class GameFinishedError extends Error {
  constructor() {
    super("ゲームは終了しています");
    this.name = "GameFinishedError";
  }
}

export function startProgress(): GameProgress {
  return { status: "playing", hintNumber: 1 };
}

function advance(hintNumber: number): GameProgress {
  if (hintNumber >= MAX_HINTS) {
    return { status: "lost", score: 0 };
  }
  return { status: "playing", hintNumber: hintNumber + 1 };
}

/** 回答の判定結果で進行を進める。 */
export function answerProgress(
  progress: GameProgress,
  isCorrect: boolean,
): GameProgress {
  if (progress.status !== "playing") {
    throw new GameFinishedError();
  }
  if (isCorrect) {
    return {
      status: "won",
      hintNumber: progress.hintNumber,
      score: scoreForHint(progress.hintNumber),
    };
  }
  return advance(progress.hintNumber);
}

/** 回答せずに次のヒントへ進む。 */
export function skipProgress(progress: GameProgress): GameProgress {
  if (progress.status !== "playing") {
    throw new GameFinishedError();
  }
  return advance(progress.hintNumber);
}
