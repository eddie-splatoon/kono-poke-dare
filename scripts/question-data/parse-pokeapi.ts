import type { BaseStats, Evolution, SpeciesFacts } from "./build-question.ts";

export class UnexpectedPokeApiResponseError extends Error {
  constructor(message: string) {
    super(`PokeAPI の応答が想定と異なります: ${message}`);
    this.name = "UnexpectedPokeApiResponseError";
  }
}

type NamedResource = { readonly name: string };

type SpeciesResponse = {
  readonly id: number;
  readonly name: string;
  readonly generation: NamedResource;
  readonly names: readonly {
    readonly name: string;
    readonly language: NamedResource;
  }[];
  readonly varieties: readonly { readonly pokemon: NamedResource }[];
};

type PokemonResponse = {
  readonly height: number;
  readonly weight: number;
  readonly types: readonly {
    readonly slot: number;
    readonly type: NamedResource;
  }[];
  readonly stats: readonly {
    readonly base_stat: number;
    readonly stat: NamedResource;
  }[];
};

type ChainLink = {
  readonly species: NamedResource;
  readonly evolves_to: readonly ChainLink[];
};

type ChainResponse = { readonly chain: ChainLink };

const GENERATIONS: Readonly<Record<string, number>> = {
  "generation-i": 1,
  "generation-ii": 2,
  "generation-iii": 3,
  "generation-iv": 4,
  "generation-v": 5,
  "generation-vi": 6,
  "generation-vii": 7,
  "generation-viii": 8,
  "generation-ix": 9,
};

const TYPE_NAMES: Readonly<Record<string, string>> = {
  normal: "ノーマル",
  fire: "ほのお",
  water: "みず",
  electric: "でんき",
  grass: "くさ",
  ice: "こおり",
  fighting: "かくとう",
  poison: "どく",
  ground: "じめん",
  flying: "ひこう",
  psychic: "エスパー",
  bug: "むし",
  rock: "いわ",
  ghost: "ゴースト",
  dragon: "ドラゴン",
  dark: "あく",
  steel: "はがね",
  fairy: "フェアリー",
};

const STAT_KEYS: Readonly<Record<string, keyof BaseStats>> = {
  hp: "hp",
  attack: "attack",
  defense: "defense",
  "special-attack": "specialAttack",
  "special-defense": "specialDefense",
  speed: "speed",
};

function japaneseName(species: SpeciesResponse): string {
  const entry =
    species.names.find(({ language }) => language.name === "ja-hrkt") ??
    species.names.find(({ language }) => language.name === "ja");
  if (entry === undefined) {
    throw new UnexpectedPokeApiResponseError(`日本語名がない: ${species.name}`);
  }
  return entry.name;
}

function generationOf(species: SpeciesResponse): number {
  const generation = GENERATIONS[species.generation.name];
  if (generation === undefined) {
    throw new UnexpectedPokeApiResponseError(
      `未知の世代: ${species.generation.name}`,
    );
  }
  return generation;
}

function typesOf(pokemon: PokemonResponse): string[] {
  return [...pokemon.types]
    .sort((a, b) => a.slot - b.slot)
    .map(({ type }) => {
      const name = TYPE_NAMES[type.name];
      if (name === undefined) {
        throw new UnexpectedPokeApiResponseError(`未知のタイプ: ${type.name}`);
      }
      return name;
    });
}

function statsOf(pokemon: PokemonResponse): BaseStats {
  const stats: Partial<Record<keyof BaseStats, number>> = {};
  for (const { base_stat, stat } of pokemon.stats) {
    const key = STAT_KEYS[stat.name];
    if (key !== undefined) {
      stats[key] = base_stat;
    }
  }
  if (Object.keys(stats).length !== Object.keys(STAT_KEYS).length) {
    throw new UnexpectedPokeApiResponseError("基礎能力が揃っていない");
  }
  return stats as BaseStats;
}

function depthBelow(link: ChainLink): number {
  return link.evolves_to.reduce(
    (deepest, next) => Math.max(deepest, depthBelow(next) + 1),
    0,
  );
}

function findEvolution(
  link: ChainLink,
  speciesName: string,
  stepsBefore: number,
): Evolution | null {
  if (link.species.name === speciesName) {
    return {
      stepsBefore,
      stepsAfter: depthBelow(link),
      branches: link.evolves_to.length,
    };
  }
  for (const next of link.evolves_to) {
    const found = findEvolution(next, speciesName, stepsBefore + 1);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

/** PokeAPI の応答から、問題の生成に使う事実だけを取り出す。説明文は取り出さない。 */
export function parseSpeciesFacts(responses: {
  readonly species: unknown;
  readonly pokemon: unknown;
  readonly chain: unknown;
}): SpeciesFacts {
  const species = responses.species as SpeciesResponse;
  const pokemon = responses.pokemon as PokemonResponse;
  const { chain } = responses.chain as ChainResponse;

  const evolution = findEvolution(chain, species.name, 0);
  if (evolution === null) {
    throw new UnexpectedPokeApiResponseError(
      `進化の系統に種族がない: ${species.name}`,
    );
  }
  return {
    number: species.id,
    name: japaneseName(species),
    generation: generationOf(species),
    // 単位はそれぞれ 0.1 m と 0.1 kg である。
    heightM: pokemon.height / 10,
    weightKg: pokemon.weight / 10,
    types: typesOf(pokemon),
    stats: statsOf(pokemon),
    evolution,
    varieties: species.varieties.map((variety) => variety.pokemon.name),
  };
}
