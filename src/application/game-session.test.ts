import { beforeEach, describe, expect, it } from "vitest";
import { MAX_HINTS } from "@/domain/scoring/score";
import { createGameSession, type GameSessionResult } from "./game-session";
import { QuestionNotFoundError } from "./game-view";
import { type DailyGameRepository, RecordStorageError } from "./ports";
import {
  createFakePersistence,
  createInMemoryDailyGameRepository,
  fakeQuestions,
  makeQuestion,
} from "./test-doubles";

const NOW = new Date("2026-11-05T03:00:00.000Z");
const clock = { now: () => NOW };

let records: ReturnType<typeof createInMemoryDailyGameRepository>;

function sessionWith(
  overrides: Partial<{ records: DailyGameRepository }> = {},
) {
  return createGameSession({
    clock,
    questions: fakeQuestions,
    records,
    persistence: createFakePersistence(),
    ...overrides,
  });
}

function expectOk(result: GameSessionResult) {
  if (!result.ok) {
    throw new Error(`失敗しました: ${result.kind}`);
  }
  return result;
}

async function started() {
  return expectOk(await sessionWith().start());
}

beforeEach(() => {
  records = createInMemoryDailyGameRepository();
});

describe("成功", () => {
  it("R-20: start は game と view を返す", async () => {
    const { game, view } = await started();

    expect(game.progress).toEqual({ status: "playing", hintNumber: 1 });
    expect(view.hintNumber).toBe(1);
  });

  it("R-20: guess は不正解なら次のヒントを返す", async () => {
    const { game } = await started();

    const result = expectOk(await sessionWith().guess(game, "チガウナマエ"));

    expect(result.view.hintNumber).toBe(2);
  });

  it("R-20: skip は次のヒントを返す", async () => {
    const { game } = await started();

    const result = expectOk(await sessionWith().skip(game));

    expect(result.view.hintNumber).toBe(2);
  });

  it("R-21: 進行中の totalScore は null で、集計しない", async () => {
    let listCalls = 0;
    const counting: DailyGameRepository = {
      update: records.update,
      list: async () => {
        listCalls += 1;
        return [];
      },
    };
    const session = sessionWith({ records: counting });

    const first = expectOk(await session.start());
    const second = expectOk(await session.skip(first.game));

    expect(first.totalScore).toBeNull();
    expect(second.totalScore).toBeNull();
    expect(listCalls).toBe(0);
  });

  it("R-22: 正解したゲームの totalScore は、そのゲームを含む", async () => {
    records.stored.set("2026-11-01", {
      date: "2026-11-01",
      questionNumber: 1,
      progress: { status: "won", hintNumber: 3, score: 80 },
    });
    const { game } = await started();
    const { name } = makeQuestion(game.questionNumber);

    const result = expectOk(await sessionWith().guess(game, name));

    expect(result.totalScore).toBe(180);
  });

  it("R-22: 当てられずに終えたゲームにも totalScore を返す", async () => {
    let result = await started();
    for (let i = 0; i < MAX_HINTS; i++) {
      result = expectOk(await sessionWith().skip(result.game));
    }

    expect(result.view.status).toBe("lost");
    expect(result.totalScore).toBe(0);
  });

  it("R-22: 終えた日にもう一度開始すると totalScore を返す", async () => {
    const { game } = await started();
    const { name } = makeQuestion(game.questionNumber);
    await sessionWith().guess(game, name);

    const resumed = expectOk(await sessionWith().start());

    expect(resumed.view.status).toBe("won");
    expect(resumed.totalScore).toBe(100);
  });

  it("R-23: 集計に失敗しても成功として、totalScore を null にする", async () => {
    const { game } = await started();
    const { name } = makeQuestion(game.questionNumber);
    const failingList: DailyGameRepository = {
      update: records.update,
      list: async () => {
        throw new RecordStorageError();
      },
    };

    const result = expectOk(
      await sessionWith({ records: failingList }).guess(game, name),
    );

    expect(result.view.status).toBe("won");
    expect(result.totalScore).toBeNull();
  });
});

describe("失敗", () => {
  const failing: DailyGameRepository = {
    update: async () => {
      throw new RecordStorageError();
    },
    list: async () => [],
  };

  it("R-24: 空の回答は empty-guess にする", async () => {
    const { game } = await started();

    const result = await sessionWith().guess(game, "   ");

    expect(result).toMatchObject({ ok: false, kind: "empty-guess" });
    expect(records.stored.get(game.date)?.progress).toEqual(game.progress);
  });

  it("R-25: 保存の失敗は storage にする", async () => {
    const { game } = await started();
    const session = sessionWith({ records: failing });

    await expect(session.start()).resolves.toMatchObject({
      ok: false,
      kind: "storage",
    });
    await expect(session.guess(game, "ア")).resolves.toMatchObject({
      ok: false,
      kind: "storage",
    });
    await expect(session.skip(game)).resolves.toMatchObject({
      ok: false,
      kind: "storage",
    });
  });

  it("R-26: その他の例外は unavailable にして、cause に入れる", async () => {
    const cause = new TypeError("Failed to fetch");
    const session = createGameSession({
      clock,
      questions: {
        count: async () => {
          throw cause;
        },
        findByNumber: async () => null,
      },
      records,
      persistence: createFakePersistence(),
    });

    await expect(session.start()).resolves.toEqual({
      ok: false,
      kind: "unavailable",
      cause,
    });
  });

  it("R-26: 問題が見つからないときも unavailable にする", async () => {
    const { game } = await started();

    const result = await sessionWith().skip({ ...game, questionNumber: 999 });

    expect(result).toMatchObject({ ok: false, kind: "unavailable" });
    expect(!result.ok && result.cause).toBeInstanceOf(QuestionNotFoundError);
  });
});
