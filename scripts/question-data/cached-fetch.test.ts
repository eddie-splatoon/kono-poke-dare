import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCachedFetch } from "./cached-fetch.ts";

const URL_A = "https://pokeapi.co/api/v2/pokemon-species/1/";

describe("createCachedFetch", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "pokeapi-cache-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const create = (fetchFile: (url: string) => Promise<Response>) =>
    createCachedFetch({
      directory,
      fetch: fetchFile,
      wait: () => Promise.resolve(),
    });

  it("R-61: キャッシュがある URL は通信せずに返す", async () => {
    const fetchFile = vi.fn(async () => Response.json({ id: 1 }));
    const fetchJson = create(fetchFile);

    await expect(fetchJson(URL_A)).resolves.toEqual({ id: 1 });
    await expect(fetchJson(URL_A)).resolves.toEqual({ id: 1 });

    expect(fetchFile).toHaveBeenCalledTimes(1);
  });

  it("R-62: HTTP エラーは例外にしてキャッシュに残さない", async () => {
    const fetchJson = create(
      async () => new Response("error", { status: 500 }),
    );

    await expect(fetchJson(URL_A)).rejects.toThrow("HTTP 500");
    await expect(readdir(directory)).resolves.toEqual([]);
  });

  it("R-63: PokeAPI 以外のオリジンは通信せずに例外にする", async () => {
    const fetchFile = vi.fn(async () => Response.json({}));
    const fetchJson = create(fetchFile);

    await expect(
      fetchJson("https://example.com/api/v2/pokemon/1/"),
    ).rejects.toThrow("PokeAPI");
    await expect(
      fetchJson("https://pokeapi.co.example.com/api/v2/pokemon/1/"),
    ).rejects.toThrow("PokeAPI");

    expect(fetchFile).not.toHaveBeenCalled();
  });
});
