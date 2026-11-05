import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import type { DailyGame } from "@/application/game-view";
import { getRecordSummary } from "@/application/get-record-summary";
import { type Clock, RecordStorageError } from "@/application/ports";
import { skipHint } from "@/application/skip-hint";
import { startDailyGame } from "@/application/start-daily-game";
import { submitGuess } from "@/application/submit-guess";
import {
  createFakePersistence,
  fakeQuestions,
  makeQuestion,
} from "@/application/test-doubles";
import { MAX_HINTS } from "@/domain/scoring/score";
import { createIndexedDbDailyGameRepository } from "./indexed-db-daily-game-repository";

const DB_NAME = "kono-poke-dare";
const STORE = "dailyGames";
const TODAY = "2026-11-05";
const clock: Clock = { now: () => new Date("2026-11-05T03:00:00.000Z") };

let factory: IDBFactory;

beforeEach(() => {
  factory = new IDBFactory();
});

/** タブごとに接続を持つ状況を、リポジトリを別に作って再現する。 */
function openTab() {
  const records = createIndexedDbDailyGameRepository(factory);
  const deps = {
    questions: fakeQuestions,
    records,
    persistence: createFakePersistence(),
  };
  return {
    records,
    deps,
    start: () => startDailyGame({ clock, ...deps }),
  };
}

const game = (overrides: Partial<DailyGame> = {}): DailyGame => ({
  date: TODAY,
  questionNumber: 1,
  progress: { status: "playing", hintNumber: 1 },
  ...overrides,
});

/** 利用者が開発者ツールで書き換えた状況を再現する。 */
async function writeRaw(values: readonly unknown[]) {
  await createIndexedDbDailyGameRepository(factory).list();
  await new Promise<void>((resolve, reject) => {
    const open = factory.open(DB_NAME);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE, "readwrite");
      for (const value of values) {
        tx.objectStore(STORE).put(value);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => reject(tx.error);
    };
  });
}

describe("update と list", () => {
  it("R-1: 保存した値を、次の update に渡す", async () => {
    const records = createIndexedDbDailyGameRepository(factory);
    const seen: (DailyGame | null)[] = [];
    const first = game();
    const second = game({ progress: { status: "playing", hintNumber: 2 } });

    await records.update(TODAY, (stored) => {
      seen.push(stored);
      return first;
    });
    const saved = await records.update(TODAY, (stored) => {
      seen.push(stored);
      return second;
    });

    expect(seen).toEqual([null, first]);
    expect(saved).toEqual(second);
    await expect(records.list()).resolves.toEqual([second]);
  });

  it("R-27: change が例外を投げたら、書き込まずにその例外で reject する", async () => {
    const records = createIndexedDbDailyGameRepository(factory);
    const original = game();
    await records.update(TODAY, () => original);
    const failure = new Error("変更に失敗");

    await expect(
      records.update(TODAY, () => {
        throw failure;
      }),
    ).rejects.toBe(failure);

    await expect(records.list()).resolves.toEqual([original]);
  });
});

describe("再読み込み", () => {
  it("R-8: 接続を作り直しても、進行と累積スコアが保たれる", async () => {
    const before = openTab();
    const { game: started } = await before.start();
    const skipped = await skipHint({ game: started }, before.deps);

    const afterSkip = openTab();
    const resumed = await afterSkip.start();
    expect(resumed.game).toEqual(skipped.game);

    const name = makeQuestion(resumed.game.questionNumber).name;
    await submitGuess({ game: resumed.game, guess: name }, afterSkip.deps);

    const afterWin = openTab();
    const finished = await afterWin.start();
    expect(finished.view.status).toBe("won");
    expect(finished.view.score).toBe(90);
    await expect(
      getRecordSummary({ records: afterWin.records }),
    ).resolves.toMatchObject({ totalScore: 90 });
  });
});

describe("複数のタブ", () => {
  it("R-9: 同時に開始しても、記録は 1 件で同じゲームになる", async () => {
    const [a, b] = await Promise.all([openTab().start(), openTab().start()]);

    expect(a.game).toEqual(b.game);
    await expect(openTab().records.list()).resolves.toEqual([a.game]);
  });

  it("R-10: 別のタブが先に終えていたら、得点を変えない", async () => {
    const tabA = openTab();
    const tabB = openTab();
    const { game: gameA } = await tabA.start();
    const { game: gameB } = await tabB.start();
    const name = makeQuestion(gameA.questionNumber).name;
    const skipped = await skipHint({ game: gameA }, tabA.deps);
    const won = await submitGuess(
      { game: skipped.game, guess: name },
      tabA.deps,
    );

    const late = await submitGuess({ game: gameB, guess: name }, tabB.deps);

    expect(late.game).toEqual(won.game);
    await expect(
      getRecordSummary({ records: tabB.records }),
    ).resolves.toMatchObject({ totalScore: 90 });
  });

  it("R-11: 古いタブの操作は、保存済みの最新のヒントを基準にする", async () => {
    const tabA = openTab();
    const tabB = openTab();
    const { game: gameA } = await tabA.start();
    const { game: gameB } = await tabB.start();
    await skipHint({ game: gameA }, tabA.deps);

    const result = await skipHint({ game: gameB }, tabB.deps);

    expect(result.view.hintNumber).toBe(3);
  });

  it("R-12: 同時に操作しても、どの操作も失われない", async () => {
    const tabA = openTab();
    const tabB = openTab();
    const { game: started } = await tabA.start();

    await Promise.all([
      skipHint({ game: started }, tabA.deps),
      skipHint({ game: started }, tabB.deps),
      skipHint({ game: started }, tabA.deps),
    ]);

    const [saved] = await tabA.records.list();
    expect(saved.progress).toEqual({ status: "playing", hintNumber: 4 });
  });

  it("R-16: 同時に正解しても、累積スコアには 1 回分だけ加算する", async () => {
    const tabA = openTab();
    const tabB = openTab();
    const { game: started } = await tabA.start();
    const guess = makeQuestion(started.questionNumber).name;

    const [a, b] = await Promise.all([
      submitGuess({ game: started, guess }, tabA.deps),
      submitGuess({ game: started, guess }, tabB.deps),
    ]);

    expect(a.game).toEqual(b.game);
    await expect(getRecordSummary({ records: tabA.records })).resolves.toEqual({
      totalScore: 100,
      history: [{ date: TODAY, status: "won", score: 100 }],
    });
  });
});

describe("不正な保存値", () => {
  const broken = [
    {
      date: "2026-11-01",
      questionNumber: "1",
      progress: { status: "lost", score: 0 },
    },
    {
      date: "2026-11-02",
      questionNumber: 1,
      progress: { status: "won", hintNumber: 1, score: 999999 },
    },
    { date: "2026-11-03", questionNumber: 1, progress: null },
    {
      date: "2026-02-30",
      questionNumber: 1,
      progress: { status: "lost", score: 0 },
    },
    {
      date: 20261104,
      questionNumber: 1,
      progress: { status: "lost", score: 0 },
    },
  ];

  it("R-25: 一覧は不正なレコードを除外する", async () => {
    const valid = game({
      date: "2026-11-04",
      progress: { status: "won", hintNumber: 2, score: 90 },
    });
    await writeRaw([...broken, valid]);

    const records = createIndexedDbDailyGameRepository(factory);

    await expect(records.list()).resolves.toEqual([valid]);
    await expect(getRecordSummary({ records })).resolves.toMatchObject({
      totalScore: 90,
    });
  });

  it("R-26: 不正なレコードは null として change に渡す", async () => {
    await writeRaw([broken[1]]);
    const records = createIndexedDbDailyGameRepository(factory);
    const seen: (DailyGame | null)[] = [];
    const replacement = game({ date: "2026-11-02" });

    await records.update("2026-11-02", (stored) => {
      seen.push(stored);
      return replacement;
    });

    expect(seen).toEqual([null]);
    await expect(records.list()).resolves.toEqual([replacement]);
  });

  it.each([
    ["得点が不正", { status: "won", hintNumber: 1, score: 999999 }],
    ["ヒント番号が範囲外", { status: "playing", hintNumber: MAX_HINTS + 1 }],
    ["形が不正", "x"],
  ])(
    "R-26: その日の記録が不正(%s)でも、新しいゲームを遊べる",
    async (_, progress) => {
      await writeRaw([{ date: TODAY, questionNumber: 1, progress }]);
      const tab = openTab();

      const started = await tab.start();
      expect(started.game.progress).toEqual({
        status: "playing",
        hintNumber: 1,
      });

      const guess = makeQuestion(started.game.questionNumber).name;
      const won = await submitGuess({ game: started.game, guess }, tab.deps);

      expect(won.view.score).toBe(100);
    },
  );
});

describe("IndexedDB を使えないとき", () => {
  it("R-28: open が例外を投げたら RecordStorageError で reject する", async () => {
    const failing = {
      open: () => {
        throw new Error("SecurityError");
      },
    } as unknown as IDBFactory;
    const records = createIndexedDbDailyGameRepository(failing);

    await expect(records.list()).rejects.toThrow(RecordStorageError);
    await expect(records.update(TODAY, () => game())).rejects.toThrow(
      RecordStorageError,
    );
  });

  it("R-28: DB のバージョンが新しくて開けなければ RecordStorageError で reject する", async () => {
    await new Promise<void>((resolve, reject) => {
      const open = factory.open(DB_NAME, 99);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
    });
    const records = createIndexedDbDailyGameRepository(factory);

    await expect(records.list()).rejects.toThrow(RecordStorageError);
  });

  it("R-28: object store がなければ RecordStorageError で reject する", async () => {
    await new Promise<void>((resolve, reject) => {
      const open = factory.open(DB_NAME, 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
    });
    const records = createIndexedDbDailyGameRepository(factory);

    await expect(records.list()).rejects.toThrow(RecordStorageError);
  });
});
