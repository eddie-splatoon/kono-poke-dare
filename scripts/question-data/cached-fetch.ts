import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const POKEAPI_ORIGIN = "https://pokeapi.co";

async function readCache(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return undefined;
  }
}

/** 応答をキャッシュする、PokeAPI 専用の JSON 取得関数を作る。 */
export function createCachedFetch({
  directory,
  fetch: fetchFile,
  wait,
}: {
  readonly directory: string;
  readonly fetch: (url: string) => Promise<Response>;
  /** 通信の前に待つ処理。Fair Use Policy に沿って、アクセスの間隔を空ける。 */
  readonly wait: () => Promise<void>;
}) {
  return async function fetchJson(url: string): Promise<unknown> {
    // 応答に含まれる URL を辿るので、取得先を確かめる。
    if (new URL(url).origin !== POKEAPI_ORIGIN) {
      throw new Error(`PokeAPI 以外の URL です: ${url}`);
    }
    const key = createHash("sha256").update(url).digest("hex");
    const path = join(directory, `${key}.json`);
    const cached = await readCache(path);
    if (cached !== undefined) {
      return cached;
    }
    await wait();
    const response = await fetchFile(url);
    if (!response.ok) {
      throw new Error(`取得できません: ${url}: HTTP ${response.status}`);
    }
    const body: unknown = await response.json();
    await mkdir(directory, { recursive: true });
    await writeFile(path, JSON.stringify(body));
    return body;
  };
}
