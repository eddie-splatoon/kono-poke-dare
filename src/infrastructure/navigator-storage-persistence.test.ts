import { describe, expect, it } from "vitest";
import { createNavigatorStoragePersistence } from "./navigator-storage-persistence";

describe("createNavigatorStoragePersistence", () => {
  it.each([true, false])("persist の結果 %s を返す", async (granted) => {
    const persistence = createNavigatorStoragePersistence({
      persist: async () => granted,
    });

    await expect(persistence.request()).resolves.toBe(granted);
  });

  it("R-32: StorageManager がなければ false を返す", async () => {
    const persistence = createNavigatorStoragePersistence(undefined);

    await expect(persistence.request()).resolves.toBe(false);
  });

  it("R-32: persist が reject しても false を返す", async () => {
    const persistence = createNavigatorStoragePersistence({
      persist: async () => {
        throw new Error("失敗");
      },
    });

    await expect(persistence.request()).resolves.toBe(false);
  });

  it("R-32: persist が同期で例外を投げても false を返す", async () => {
    const persistence = createNavigatorStoragePersistence({
      persist: () => {
        throw new Error("失敗");
      },
    });

    await expect(persistence.request()).resolves.toBe(false);
  });
});
