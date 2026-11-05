import { beforeEach, describe, expect, it } from "vitest";
import { MAX_HINTS } from "@/domain/scoring/score";
import type { DailyGame } from "./game-view";
import { getRecordSummary } from "./get-record-summary";
import {
  type Clock,
  type DailyGameRepository,
  RecordStorageError,
} from "./ports";
import { skipHint } from "./skip-hint";
import { startDailyGame } from "./start-daily-game";
import { submitGuess } from "./submit-guess";
import {
  createFakePersistence,
  createInMemoryDailyGameRepository,
  fakeQuestions,
  makeQuestion,
  QUESTION_COUNT,
} from "./test-doubles";

const clockAt = (instant: string): Clock => ({
  now: () => new Date(instant),
});

const NOW = "2026-11-05T03:00:00.000Z";
const TODAY = "2026-11-05";
const WRONG = "チガウナマエ";

let records: ReturnType<typeof createInMemoryDailyGameRepository>;
let persistence: ReturnType<typeof createFakePersistence>;
let deps: {
  questions: typeof fakeQuestions;
  records: DailyGameRepository;
  persistence: typeof persistence;
};

beforeEach(() => {
  records = createInMemoryDailyGameRepository();
  persistence = createFakePersistence();
  deps = { questions: fakeQuestions, records, persistence };
});

const start = (instant = NOW) =>
  startDailyGame({
    clock: clockAt(instant),
    questions: fakeQuestions,
    records,
  });

async function win(game: DailyGame) {
  const guess = makeQuestion(game.questionNumber).name;
  return submitGuess({ game, guess }, deps);
}

describe("開始と再開", () => {
  it("R-1: 同じ日にもう一度開始すると、保存済みの進行を返す", async () => {
    const { game } = await start();
    await skipHint({ game }, deps);

    const resumed = await start("2026-11-05T10:00:00.000Z");

    expect(resumed.game.progress).toEqual({ status: "playing", hintNumber: 2 });
    expect(resumed.view.visibleHints).toHaveLength(2);
  });

  it("R-1: 終えた日にもう一度開始すると、結果を返す", async () => {
    const { game } = await start();
    await win(game);

    const resumed = await start();

    expect(resumed.view.status).toBe("won");
    expect(resumed.view.score).toBe(100);
    expect(resumed.view.answer).toBe(makeQuestion(game.questionNumber).name);
  });

  it("R-2: 開始した時点で、その日の記録を保存する", async () => {
    const { game } = await start();

    expect(records.stored.get(TODAY)).toEqual(game);
  });

  it("R-3: 別の日に開始すると新しいゲームになり、前の日の記録は残る", async () => {
    const { game } = await start();
    await skipHint({ game }, deps);

    const next = await start("2026-11-05T15:00:00.000Z");

    expect(next.game.date).toBe("2026-11-06");
    expect(next.game.progress).toEqual({ status: "playing", hintNumber: 1 });
    expect(records.stored.get(TODAY)?.progress).toEqual({
      status: "playing",
      hintNumber: 2,
    });
  });

  it("R-4: 保存された問題番号の問題がなければ、新しいゲームで置き換える", async () => {
    records.stored.set(TODAY, {
      date: TODAY,
      questionNumber: QUESTION_COUNT + 100,
      progress: { status: "won", hintNumber: 1, score: 100 },
    });

    const { game, view } = await start();

    expect(game.questionNumber).toBeLessThanOrEqual(QUESTION_COUNT);
    expect(view.status).toBe("playing");
    expect(records.stored.get(TODAY)).toEqual(game);
  });

  it("R-31: 開始のときは永続化を要求しない", async () => {
    await start();

    expect(persistence.requests()).toBe(0);
  });
});

describe("操作の保存", () => {
  it("R-5: 回答の結果を保存する", async () => {
    const { game } = await start();

    const wrong = await submitGuess({ game, guess: WRONG }, deps);
    expect(records.stored.get(TODAY)).toEqual(wrong.game);

    const won = await win(wrong.game);
    expect(records.stored.get(TODAY)).toEqual(won.game);
    expect(won.game.progress).toEqual({
      status: "won",
      hintNumber: 2,
      score: 90,
    });
  });

  it("R-6: 次へ進む操作の結果を保存する", async () => {
    const { game } = await start();

    const skipped = await skipHint({ game }, deps);

    expect(records.stored.get(TODAY)).toEqual(skipped.game);
    expect(skipped.game.progress).toEqual({ status: "playing", hintNumber: 2 });
  });

  it("R-7: 0 時をまたいだゲームは、開始した日の記録に保存する", async () => {
    const { game } = await start("2026-11-05T14:59:59.999Z");
    const nextDay = await start("2026-11-05T15:00:00.000Z");

    await skipHint({ game }, deps);

    expect(records.stored.get(TODAY)?.progress).toEqual({
      status: "playing",
      hintNumber: 2,
    });
    expect(records.stored.get("2026-11-06")).toEqual(nextDay.game);
  });
});

describe("複数のタブ", () => {
  it("R-10: 別のタブが先に終えていたら、保存済みの結果を返す", async () => {
    const { game: staleTab } = await start();
    const skipped = await skipHint({ game: staleTab }, deps);
    const won = await win(skipped.game);
    expect(won.view.score).toBe(90);

    const correct = await win(staleTab);
    const wrong = await submitGuess({ game: staleTab, guess: WRONG }, deps);
    const skip = await skipHint({ game: staleTab }, deps);

    for (const result of [correct, wrong, skip]) {
      expect(result.game).toEqual(won.game);
      expect(result.view.score).toBe(90);
    }
    expect(records.stored.get(TODAY)).toEqual(won.game);
  });

  it("R-11: 古いタブの操作は、保存済みの最新のヒントを基準にする", async () => {
    const { game: staleTab } = await start();
    let current = staleTab;
    for (let i = 0; i < 4; i++) {
      current = (await skipHint({ game: current }, deps)).game;
    }

    const won = await win(staleTab);

    expect(won.game.progress).toEqual({
      status: "won",
      hintNumber: 5,
      score: 60,
    });
    expect(won.view.visibleHints).toHaveLength(5);
  });

  it("R-13: 保存済みの問題番号が手元と異なれば、保存済みの値とその問題を返す", async () => {
    const { game } = await start();
    const otherNumber = (game.questionNumber % QUESTION_COUNT) + 1;
    const stored: DailyGame = {
      date: TODAY,
      questionNumber: otherNumber,
      progress: { status: "playing", hintNumber: 3 },
    };
    records.stored.set(TODAY, stored);

    const result = await win(game);

    expect(result.game).toEqual(stored);
    expect(result.view.visibleHints).toEqual(
      makeQuestion(otherNumber).hints.slice(0, 3),
    );
    expect(records.stored.get(TODAY)).toEqual(stored);
  });
});

describe("getRecordSummary", () => {
  const record = (
    date: string,
    progress: DailyGame["progress"],
  ): DailyGame => ({
    date,
    questionNumber: 1,
    progress,
  });

  it("R-14: 累積スコアは、終了したゲームの得点の合計である", async () => {
    records.stored.set(
      "2026-11-01",
      record("2026-11-01", { status: "won", hintNumber: 1, score: 100 }),
    );
    records.stored.set(
      "2026-11-02",
      record("2026-11-02", { status: "lost", score: 0 }),
    );
    records.stored.set(
      "2026-11-03",
      record("2026-11-03", { status: "won", hintNumber: 4, score: 70 }),
    );

    const summary = await getRecordSummary({ records });

    expect(summary.totalScore).toBe(170);
  });

  it("R-15: 進行中のゲームは加算しない", async () => {
    const { game } = await start();
    await skipHint({ game }, deps);

    const summary = await getRecordSummary({ records });

    expect(summary.totalScore).toBe(0);
  });

  it("R-16: 同じ日のゲームを何度終えても、1 回分だけ加算する", async () => {
    const { game } = await start();
    await win(game);
    await win(game);

    const summary = await getRecordSummary({ records });

    expect(summary.totalScore).toBe(100);
    expect(summary.history).toHaveLength(1);
  });

  it("R-17: 記録がなければ、累積スコアは 0 で履歴は空である", async () => {
    await expect(getRecordSummary({ records })).resolves.toEqual({
      totalScore: 0,
      history: [],
    });
  });

  it("R-18: 履歴は日付の新しい順で、必要な項目だけを持つ", async () => {
    records.stored.set(
      "2026-11-02",
      record("2026-11-02", { status: "lost", score: 0 }),
    );
    records.stored.set(
      "2026-11-03",
      record("2026-11-03", { status: "playing", hintNumber: 2 }),
    );
    records.stored.set(
      "2026-11-01",
      record("2026-11-01", { status: "won", hintNumber: 1, score: 100 }),
    );

    const { history } = await getRecordSummary({ records });

    expect(history).toStrictEqual([
      { date: "2026-11-03", status: "playing", score: null },
      { date: "2026-11-02", status: "lost", score: 0 },
      { date: "2026-11-01", status: "won", score: 100 },
    ]);
  });
});

describe("保存の失敗", () => {
  const failing: DailyGameRepository = {
    update: async () => {
      throw new RecordStorageError();
    },
    list: async () => {
      throw new RecordStorageError();
    },
  };

  it("R-29: 保存に失敗したら、エラーを伝えて状態を進めない", async () => {
    const { game } = await start();
    const failingDeps = { ...deps, records: failing };

    await expect(
      submitGuess({ game, guess: WRONG }, failingDeps),
    ).rejects.toThrow(RecordStorageError);
    await expect(skipHint({ game }, failingDeps)).rejects.toThrow(
      RecordStorageError,
    );

    expect(records.stored.get(TODAY)?.progress).toEqual({
      status: "playing",
      hintNumber: 1,
    });
    expect(persistence.requests()).toBe(0);
  });

  it("R-28: 開始と集計でも RecordStorageError を伝える", async () => {
    await expect(
      startDailyGame({
        clock: clockAt(NOW),
        questions: fakeQuestions,
        records: failing,
      }),
    ).rejects.toThrow(RecordStorageError);
    await expect(getRecordSummary({ records: failing })).rejects.toThrow(
      RecordStorageError,
    );
  });
});

describe("永続化の要求", () => {
  it("R-30: 正解で終わったときに要求する", async () => {
    const { game } = await start();

    await win(game);

    expect(persistence.requests()).toBe(1);
  });

  it("R-30: 当てられずに終わったときに要求する", async () => {
    let { game } = await start();
    for (let i = 0; i < MAX_HINTS; i++) {
      game = (await skipHint({ game }, deps)).game;
    }

    expect(game.progress.status).toBe("lost");
    expect(persistence.requests()).toBe(1);
  });

  it("R-31: 結果が進行中のときは要求しない", async () => {
    const { game } = await start();

    const wrong = await submitGuess({ game, guess: WRONG }, deps);
    await skipHint({ game: wrong.game }, deps);

    expect(persistence.requests()).toBe(0);
  });
});
