import { describe, expect, it } from "vitest";
import { GameFinishedError } from "@/domain/game/game-progress";
import type { Question } from "@/domain/game/question";
import { MAX_HINTS } from "@/domain/scoring/score";
import { type DailyGame, QuestionNotFoundError } from "./game-view";
import type { Clock, QuestionRepository } from "./ports";
import { skipHint } from "./skip-hint";
import { startDailyGame } from "./start-daily-game";
import { EmptyGuessError, submitGuess } from "./submit-guess";

const QUESTION_COUNT = 5;

function makeQuestion(number: number): Question {
  return {
    number,
    name: `ナマエ${number}`,
    aliases: [`ベツメイ${number}`],
    hints: Array.from(
      { length: MAX_HINTS },
      (_, i) => `問題${number}のヒント${i + 1}`,
    ),
  };
}

const questions: QuestionRepository = {
  count: async () => QUESTION_COUNT,
  findByNumber: async (number) =>
    number >= 1 && number <= QUESTION_COUNT ? makeQuestion(number) : null,
};

const clockAt = (instant: string): Clock => ({
  now: () => new Date(instant),
});

const NOW = "2026-11-05T03:00:00.000Z";

async function start(instant = NOW) {
  return startDailyGame({ clock: clockAt(instant), questions });
}

async function skipTimes(game: DailyGame, times: number) {
  let current = await skipHint({ game }, { questions });
  for (let i = 1; i < times; i++) {
    current = await skipHint({ game: current.game }, { questions });
  }
  return current;
}

describe("startDailyGame", () => {
  it("R-26: JST の日付、その日の問題、ヒント 1 を返す", async () => {
    const { game, view } = await start("2026-11-05T15:00:00.000Z");

    expect(game.date).toBe("2026-11-06");
    expect(game.questionNumber).toBeGreaterThanOrEqual(1);
    expect(game.questionNumber).toBeLessThanOrEqual(QUESTION_COUNT);
    expect(game.progress).toEqual({ status: "playing", hintNumber: 1 });
    expect(view.date).toBe("2026-11-06");
    expect(view.status).toBe("playing");
    expect(view.hintNumber).toBe(1);
    expect(view.score).toBeNull();
  });

  it("R-27: 同じ JST の日付なら、時刻が違っても同じ問題になる", async () => {
    const first = await start("2026-11-04T15:00:00.000Z");
    const last = await start("2026-11-05T14:59:59.999Z");

    expect(first.game.date).toBe(last.game.date);
    expect(first.game.questionNumber).toBe(last.game.questionNumber);
  });

  it("R-28: JST の 0 時をまたぐと別の問題になる", async () => {
    const before = await start("2026-11-05T14:59:59.999Z");
    const after = await start("2026-11-05T15:00:00.000Z");

    expect(after.game.questionNumber).not.toBe(before.game.questionNumber);
  });

  it("R-37: 問題が見つからなければエラーにする", async () => {
    const empty: QuestionRepository = {
      count: async () => QUESTION_COUNT,
      findByNumber: async () => null,
    };

    await expect(
      startDailyGame({ clock: clockAt(NOW), questions: empty }),
    ).rejects.toThrow(QuestionNotFoundError);
  });
});

describe("submitGuess", () => {
  it("R-29: 正解なら won と得点を返す", async () => {
    const { game } = await start();
    const name = makeQuestion(game.questionNumber).name;

    const result = await submitGuess({ game, guess: name }, { questions });

    expect(result.game.progress).toEqual({
      status: "won",
      hintNumber: 1,
      score: 100,
    });
    expect(result.view.status).toBe("won");
    expect(result.view.score).toBe(100);
  });

  it("R-29: 表記ゆれのある別名でも正解になる", async () => {
    const { game } = await start();
    const guess = `べつめい${game.questionNumber}`;

    const result = await submitGuess({ game, guess }, { questions });

    expect(result.view.status).toBe("won");
  });

  it("R-30: 不正解なら次のヒントを返す", async () => {
    const { game } = await start();

    const result = await submitGuess(
      { game, guess: "チガウナマエ" },
      { questions },
    );

    expect(result.view.status).toBe("playing");
    expect(result.view.hintNumber).toBe(2);
    expect(result.view.score).toBeNull();
  });

  it.each(["", "   ", "・"])(
    "R-31: 空の回答 %j はエラーにする",
    async (guess) => {
      const { game } = await start();

      await expect(submitGuess({ game, guess }, { questions })).rejects.toThrow(
        EmptyGuessError,
      );
      expect(game.progress).toEqual({ status: "playing", hintNumber: 1 });
    },
  );

  it("R-37: 問題が見つからなければエラーにする", async () => {
    const { game } = await start();

    await expect(
      submitGuess(
        { game: { ...game, questionNumber: QUESTION_COUNT + 1 }, guess: "ア" },
        { questions },
      ),
    ).rejects.toThrow(QuestionNotFoundError);
  });

  it("R-38: 終了したゲームに回答するとエラーにする", async () => {
    const { game } = await start();
    const name = makeQuestion(game.questionNumber).name;
    const won = await submitGuess({ game, guess: name }, { questions });

    await expect(
      submitGuess({ game: won.game, guess: name }, { questions }),
    ).rejects.toThrow(GameFinishedError);
  });
});

describe("skipHint", () => {
  it("R-32: 次のヒントを返す", async () => {
    const { game } = await start();

    const result = await skipHint({ game }, { questions });

    expect(result.view.status).toBe("playing");
    expect(result.view.hintNumber).toBe(2);
  });

  it("R-37: 問題が見つからなければエラーにする", async () => {
    const { game } = await start();

    await expect(
      skipHint(
        { game: { ...game, questionNumber: QUESTION_COUNT + 1 } },
        { questions },
      ),
    ).rejects.toThrow(QuestionNotFoundError);
  });

  it("R-38: 終了したゲームで次へ進むとエラーにする", async () => {
    const { game } = await start();
    const lost = await skipTimes(game, MAX_HINTS);

    expect(lost.view.status).toBe("lost");
    await expect(skipHint({ game: lost.game }, { questions })).rejects.toThrow(
      GameFinishedError,
    );
  });
});

describe("GameView", () => {
  it("R-33: visibleHints は現在のヒントまでだけを含む", async () => {
    const { game, view } = await start();
    const { hints } = makeQuestion(game.questionNumber);

    expect(view.visibleHints).toEqual(hints.slice(0, 1));

    const third = await skipTimes(game, 2);
    expect(third.view.visibleHints).toEqual(hints.slice(0, 3));
  });

  it("R-33: 正解で終わったら、当てたヒントまでだけを含む", async () => {
    const { game } = await start();
    const { hints, name } = makeQuestion(game.questionNumber);
    const second = await skipHint({ game }, { questions });

    const won = await submitGuess(
      { game: second.game, guess: name },
      { questions },
    );

    expect(won.view.hintNumber).toBe(2);
    expect(won.view.visibleHints).toEqual(hints.slice(0, 2));
  });

  it("R-33: 当てられずに終わったら、すべてのヒントを含む", async () => {
    const { game } = await start();
    const { hints } = makeQuestion(game.questionNumber);

    const lost = await skipTimes(game, MAX_HINTS);

    expect(lost.view.hintNumber).toBe(MAX_HINTS);
    expect(lost.view.visibleHints).toEqual(hints);
    expect(lost.view.score).toBe(0);
  });

  it("R-34: 進行中は answer が null である", async () => {
    const started = await start();
    const skipped = await skipHint({ game: started.game }, { questions });
    const wrong = await submitGuess(
      { game: started.game, guess: "チガウナマエ" },
      { questions },
    );

    expect(started.view.answer).toBeNull();
    expect(skipped.view.answer).toBeNull();
    expect(wrong.view.answer).toBeNull();
  });

  it("R-35: 正解で終わったら answer に正解の名前が入る", async () => {
    const { game } = await start();
    const { name } = makeQuestion(game.questionNumber);

    const won = await submitGuess({ game, guess: name }, { questions });

    expect(won.view.answer).toBe(name);
  });

  it("R-35: 当てられずに終わったら answer に正解の名前が入る", async () => {
    const { game } = await start();
    const { name } = makeQuestion(game.questionNumber);

    const lost = await skipTimes(game, MAX_HINTS);

    expect(lost.view.answer).toBe(name);
  });
});

describe("0 時をまたいだゲーム", () => {
  it("R-36: 開始した日の問題のまま続く", async () => {
    const started = await start("2026-11-05T14:59:59.999Z");
    const nextDay = await start("2026-11-05T15:00:00.000Z");
    const { name } = makeQuestion(started.game.questionNumber);

    const result = await submitGuess(
      { game: started.game, guess: name },
      { questions },
    );

    expect(nextDay.game.questionNumber).not.toBe(started.game.questionNumber);
    expect(result.view.date).toBe("2026-11-05");
    expect(result.view.status).toBe("won");
  });
});
