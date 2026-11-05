import type { DailyGame } from "@/application/game-view";
import {
  type DailyGameRepository,
  RecordStorageError,
} from "@/application/ports";
import { parseDailyGameRecord } from "./daily-game-record";

const DB_NAME = "kono-poke-dare";
const DB_VERSION = 1;
const STORE_NAME = "dailyGames";

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "date" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 操作ごとに接続を開いて閉じる。
 * 接続を持ち続けないので、将来のバージョン更新で他のタブを止めない。
 * run は、トランザクションの完了後の値を返す関数を返す。
 */
async function withStore<T>(
  factory: IDBFactory,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore, transaction: IDBTransaction) => () => T,
): Promise<T> {
  let db: IDBDatabase;
  try {
    db = await openDatabase(factory);
  } catch (cause) {
    throw new RecordStorageError(cause);
  }
  try {
    const transaction = db.transaction(STORE_NAME, mode);
    const getResult = run(transaction.objectStore(STORE_NAME), transaction);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    return getResult();
  } catch (cause) {
    throw new RecordStorageError(cause);
  } finally {
    db.close();
  }
}

export function createIndexedDbDailyGameRepository(
  factory: IDBFactory,
): DailyGameRepository {
  return {
    update: async (date, change) => {
      let saved: DailyGame | undefined;
      let changeFailure: { readonly cause: unknown } | undefined;
      try {
        return await withStore(factory, "readwrite", (store, transaction) => {
          const read = store.get(date);
          read.onsuccess = () => {
            try {
              saved = change(parseDailyGameRecord(read.result));
            } catch (cause) {
              changeFailure = { cause };
              transaction.abort();
              return;
            }
            store.put(saved);
          };
          return () => saved as DailyGame;
        });
      } catch (error) {
        throw changeFailure === undefined ? error : changeFailure.cause;
      }
    },
    list: () =>
      withStore(factory, "readonly", (store) => {
        const read = store.getAll();
        return () =>
          (read.result as unknown[])
            .map(parseDailyGameRecord)
            .filter((game) => game !== null);
      }),
  };
}
