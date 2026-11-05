import {
  createGameSession,
  type GameSession,
} from "@/application/game-session";
import { createIndexedDbDailyGameRepository } from "@/infrastructure/indexed-db-daily-game-repository";
import { createNavigatorStoragePersistence } from "@/infrastructure/navigator-storage-persistence";
import { createStaticQuestionRepository } from "@/infrastructure/static-question-repository";

/**
 * ブラウザの API でセッションを組み立てる。
 * 静的書き出しのときはブラウザの API がないが、操作を呼ぶまでは使わない。
 */
export function createBrowserGameSession(): GameSession {
  return createGameSession({
    clock: { now: () => new Date() },
    questions: createStaticQuestionRepository({
      baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH}/data/questions`,
      fetch: (url) => fetch(url),
    }),
    records: createIndexedDbDailyGameRepository(globalThis.indexedDB),
    persistence: createNavigatorStoragePersistence(
      globalThis.navigator?.storage,
    ),
  });
}
