import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import type { AdvanceGameDeps } from "@/application/advance-game";
import type { Clock } from "@/application/ports";
import { skipHint } from "@/application/skip-hint";
import { startDailyGame } from "@/application/start-daily-game";
import { submitGuess } from "@/application/submit-guess";
import {
  createFakePersistence,
  createInMemoryDailyGameRepository,
} from "@/application/test-doubles";
import { MAX_HINTS } from "@/domain/scoring/score";
import {
  createStaticQuestionRepository,
  InvalidQuestionDataError,
  QuestionDataFetchError,
} from "./static-question-repository";

const BASE_URL = "/kono-poke-dare/data/questions";

const question = {
  number: 1,
  name: "カセツモン",
  aliases: [],
  hints: Array.from({ length: 10 }, (_, i) => `ヒントの本文その${i + 1}`),
};

type Routes = Record<string, Response | (() => Response)>;

/** 取得した URL を記録する fake の fetch を作る。 */
function fakeFetch(routes: Routes) {
  const requested: string[] = [];
  const fetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    requested.push(url);
    const route = routes[url];
    if (route === undefined) {
      return new Response("not found", { status: 404 });
    }
    return typeof route === "function" ? route() : route;
  };
  return { fetch, requested };
}

const json = (value: unknown) => () => Response.json(value);

const INDEX_URL = `${BASE_URL}/index.json`;
const FIRST_URL = `${BASE_URL}/0001.json`;

function repositoryWith(routes: Routes) {
  const { fetch, requested } = fakeFetch(routes);
  return {
    repository: createStaticQuestionRepository({ baseUrl: BASE_URL, fetch }),
    requested,
  };
}

describe("count", () => {
  it("R-22: index.json の問題数を返す", async () => {
    const { repository } = repositoryWith({
      [INDEX_URL]: json({ count: 3 }),
    });

    await expect(repository.count()).resolves.toBe(3);
  });

  it("R-23: index.json を 2 回取得しない", async () => {
    const { repository, requested } = repositoryWith({
      [INDEX_URL]: json({ count: 3 }),
    });

    await repository.count();
    await repository.count();

    expect(requested).toEqual([INDEX_URL]);
  });

  it("R-27: 検証を通らない index.json はエラーにする", async () => {
    const { repository } = repositoryWith({
      [INDEX_URL]: json({ count: 0 }),
    });

    await expect(repository.count()).rejects.toThrow(InvalidQuestionDataError);
  });

  it("R-29: index.json の 404 はエラーにする", async () => {
    const { repository } = repositoryWith({});

    await expect(repository.count()).rejects.toThrow(QuestionDataFetchError);
  });
});

describe("findByNumber", () => {
  it("R-24: 番号を 4 桁にしたファイルを取得して返す", async () => {
    const { repository, requested } = repositoryWith({
      [INDEX_URL]: json({ count: 1 }),
      [FIRST_URL]: json(question),
    });

    await expect(repository.findByNumber(1)).resolves.toEqual(question);
    expect(requested).toContain(FIRST_URL);
  });

  it.each([0, -1, 2, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "R-25: 番号 %d では問題のファイルを取得せず null を返す",
    async (number) => {
      const { repository, requested } = repositoryWith({
        [INDEX_URL]: json({ count: 1 }),
      });

      await expect(repository.findByNumber(number)).resolves.toBeNull();
      expect(requested.filter((url) => url !== INDEX_URL)).toEqual([]);
    },
  );

  it("R-26: 問題のファイルが 404 なら null を返す", async () => {
    const { repository } = repositoryWith({
      [INDEX_URL]: json({ count: 1 }),
    });

    await expect(repository.findByNumber(1)).resolves.toBeNull();
  });

  it("R-27: 検証を通らない応答はエラーにする", async () => {
    const { repository } = repositoryWith({
      [INDEX_URL]: json({ count: 1 }),
      [FIRST_URL]: json({ ...question, hints: question.hints.slice(1) }),
    });

    await expect(repository.findByNumber(1)).rejects.toThrow(
      InvalidQuestionDataError,
    );
  });

  it("R-27: JSON として読めない応答はエラーにする", async () => {
    const { repository } = repositoryWith({
      [INDEX_URL]: json({ count: 1 }),
      [FIRST_URL]: () => new Response("<html></html>"),
    });

    await expect(repository.findByNumber(1)).rejects.toThrow(
      InvalidQuestionDataError,
    );
  });

  it("R-28: ファイルの番号と number が異なる応答はエラーにする", async () => {
    const { repository } = repositoryWith({
      [INDEX_URL]: json({ count: 1 }),
      [FIRST_URL]: json({ ...question, number: 2 }),
    });

    await expect(repository.findByNumber(1)).rejects.toThrow(
      InvalidQuestionDataError,
    );
  });

  it("R-29: 404 以外の HTTP エラーはエラーにする", async () => {
    const { repository } = repositoryWith({
      [INDEX_URL]: json({ count: 1 }),
      [FIRST_URL]: () => new Response("error", { status: 500 }),
    });

    await expect(repository.findByNumber(1)).rejects.toThrow(
      QuestionDataFetchError,
    );
  });

  it("R-37: fetch を this なしで呼び出す", async () => {
    const receivers: unknown[] = [];
    const repository = createStaticQuestionRepository({
      baseUrl: BASE_URL,
      fetch(this: unknown) {
        receivers.push(this);
        return Promise.resolve(Response.json({ count: 1 }));
      },
    });

    await repository.count();

    expect(receivers).toEqual([undefined]);
  });
});

describe("配信するデータ", () => {
  const dataDirectory = new URL(
    "../../public/data/questions/",
    import.meta.url,
  );

  /** public/ のファイルを、配信されたときと同じように返す。 */
  const fetchFromPublic = async (input: RequestInfo | URL) => {
    const fileName = String(input).slice(`${BASE_URL}/`.length);
    const path = fileURLToPath(new URL(fileName, dataDirectory));
    return new Response(await readFile(path, "utf8"));
  };

  const questions = createStaticQuestionRepository({
    baseUrl: BASE_URL,
    fetch: fetchFromPublic,
  });
  const clock: Clock = { now: () => new Date("2026-11-05T03:00:00.000Z") };

  let deps: AdvanceGameDeps;

  beforeEach(() => {
    deps = {
      questions,
      records: createInMemoryDailyGameRepository(),
      persistence: createFakePersistence(),
    };
  });

  it("R-30: 始めて、正解すると won になる", async () => {
    const { game, view } = await startDailyGame({ clock, ...deps });
    const loaded = await questions.findByNumber(game.questionNumber);
    if (loaded === null) {
      throw new Error("問題を読み込めませんでした");
    }

    expect(view.visibleHints).toEqual(loaded.hints.slice(0, 1));

    const won = await submitGuess({ game, guess: loaded.name }, deps);

    expect(won.view.status).toBe("won");
    expect(won.view.answer).toBe(loaded.name);
  });

  it("R-30: 10 個のヒントを見て当てられなければ lost になる", async () => {
    const started = await startDailyGame({ clock, ...deps });

    let current = started;
    for (let i = 0; i < MAX_HINTS; i++) {
      current = await skipHint({ game: current.game }, deps);
    }

    expect(current.view.status).toBe("lost");
    expect(current.view.visibleHints).toHaveLength(MAX_HINTS);
  });
});
