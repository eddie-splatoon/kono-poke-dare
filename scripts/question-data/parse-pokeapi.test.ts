import { describe, expect, it } from "vitest";
import {
  parseSpeciesFacts,
  UnexpectedPokeApiResponseError,
} from "./parse-pokeapi.ts";

const species = {
  id: 3,
  name: "kasetsu-c",
  generation: { name: "generation-iv" },
  names: [
    { name: "Kasetsu", language: { name: "en" } },
    { name: "Kasetsumon", language: { name: "ja-roma" } },
    { name: "カセツモン", language: { name: "ja-hrkt" } },
  ],
  varieties: [
    { pokemon: { name: "kasetsu-c" } },
    { pokemon: { name: "kasetsu-c-mega" } },
  ],
  flavor_text_entries: [{ flavor_text: "図鑑の説明文の本文" }],
};

const pokemon = {
  height: 7,
  weight: 1000,
  types: [
    { slot: 2, type: { name: "poison" } },
    { slot: 1, type: { name: "grass" } },
  ],
  stats: [
    { base_stat: 1, stat: { name: "hp" } },
    { base_stat: 2, stat: { name: "attack" } },
    { base_stat: 3, stat: { name: "defense" } },
    { base_stat: 4, stat: { name: "special-attack" } },
    { base_stat: 5, stat: { name: "special-defense" } },
    { base_stat: 6, stat: { name: "speed" } },
  ],
};

const chain = {
  chain: {
    species: { name: "kasetsu-a" },
    evolves_to: [
      {
        species: { name: "kasetsu-b" },
        evolves_to: [
          { species: { name: "kasetsu-c" }, evolves_to: [] },
          { species: { name: "kasetsu-d" }, evolves_to: [] },
        ],
      },
    ],
  },
};

const parse = (overrides: { species?: unknown; chain?: unknown } = {}) =>
  parseSpeciesFacts({
    species: overrides.species ?? species,
    pokemon,
    chain: overrides.chain ?? chain,
  });

describe("parseSpeciesFacts", () => {
  it("R-55: 日本語名、世代、タイプ、基礎能力を取り出す", () => {
    expect(parse()).toMatchObject({
      number: 3,
      name: "カセツモン",
      generation: 4,
      types: ["くさ", "どく"],
      stats: {
        hp: 1,
        attack: 2,
        defense: 3,
        specialAttack: 4,
        specialDefense: 5,
        speed: 6,
      },
      varieties: ["kasetsu-c", "kasetsu-c-mega"],
    });
  });

  it("R-56: 高さと重さの単位を変換する", () => {
    expect(parse()).toMatchObject({ heightM: 0.7, weightKg: 100 });
  });

  it("R-57: 進化の系統から段階を求める", () => {
    expect(parse().evolution).toEqual({
      stepsBefore: 2,
      stepsAfter: 0,
      branches: 0,
    });
    const first = parse({ species: { ...species, name: "kasetsu-a" } });
    expect(first.evolution).toEqual({
      stepsBefore: 0,
      stepsAfter: 2,
      branches: 1,
    });
    const middle = parse({ species: { ...species, name: "kasetsu-b" } });
    expect(middle.evolution).toEqual({
      stepsBefore: 1,
      stepsAfter: 1,
      branches: 2,
    });
  });

  it("R-58: 図鑑の説明文を含めない", () => {
    expect(JSON.stringify(parse())).not.toContain("図鑑の説明文");
  });

  it("R-59: 日本語名がない応答はエラーにする", () => {
    expect(() => parse({ species: { ...species, names: [] } })).toThrow(
      UnexpectedPokeApiResponseError,
    );
  });

  it("R-60: 系統の中に種族が見つからない応答はエラーにする", () => {
    expect(() =>
      parse({
        chain: { chain: { species: { name: "other" }, evolves_to: [] } },
      }),
    ).toThrow(UnexpectedPokeApiResponseError);
  });
});
