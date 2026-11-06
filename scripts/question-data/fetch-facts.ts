import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createCachedFetch } from "./cached-fetch.ts";
import { parseSpeciesFacts } from "./parse-pokeapi.ts";

/** 世代ごとの図鑑番号の範囲。 */
const GENERATION_RANGES: Readonly<
  Record<string, readonly [first: number, last: number]>
> = {
  1: [1, 151],
  2: [152, 251],
  3: [252, 386],
  4: [387, 493],
  5: [494, 649],
  6: [650, 721],
  7: [722, 809],
  8: [810, 905],
  9: [906, 1025],
};

const API_ROOT = "https://pokeapi.co/api/v2";
const REQUEST_INTERVAL_MS = 200;
const pathOf = (relative: string) =>
  fileURLToPath(new URL(`../../${relative}`, import.meta.url));

const generation = process.argv[2] ?? "";
const range = GENERATION_RANGES[generation];
if (range === undefined) {
  throw new Error("世代を 1〜9 で指定してください: pnpm data:fetch 1");
}

const fetchJson = createCachedFetch({
  directory: pathOf(".cache/pokeapi"),
  fetch: (url) => fetch(url),
  wait: () => sleep(REQUEST_INTERVAL_MS),
});

const facts = [];
for (let number = range[0]; number <= range[1]; number++) {
  const species = (await fetchJson(
    `${API_ROOT}/pokemon-species/${number}/`,
  )) as {
    evolution_chain: { url: string };
  };
  facts.push(
    parseSpeciesFacts({
      species,
      pokemon: await fetchJson(`${API_ROOT}/pokemon/${number}/`),
      chain: await fetchJson(species.evolution_chain.url),
    }),
  );
}

const outputDirectory = pathOf("data/question-sources/facts");
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  `${outputDirectory}/gen-${generation}.json`,
  `${JSON.stringify(facts, null, 2)}\n`,
);
console.log(`第 ${generation} 世代: ${facts.length} 種を保存しました`);
