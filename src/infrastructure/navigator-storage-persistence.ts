import type { StoragePersistence } from "@/application/ports";

/** navigator.storage を受け取る。未対応のブラウザでは undefined になる。 */
export function createNavigatorStoragePersistence(
  storage: Pick<StorageManager, "persist"> | undefined,
): StoragePersistence {
  return {
    request: async () => {
      try {
        return (await storage?.persist()) ?? false;
      } catch {
        return false;
      }
    },
  };
}
