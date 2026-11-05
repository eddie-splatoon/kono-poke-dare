export type BaseStats = {
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly specialAttack: number;
  readonly specialDefense: number;
  readonly speed: number;
};

export type Evolution = {
  /** この段階までに経た進化の回数。 */
  readonly stepsBefore: number;
  /** この段階から進化できる最大の回数。 */
  readonly stepsAfter: number;
  /** 直後の進化先の数。 */
  readonly branches: number;
};

/** PokeAPI から取り出した、種族の事実。 */
export type SpeciesFacts = {
  readonly number: number;
  readonly name: string;
  readonly generation: number;
  readonly heightM: number;
  readonly weightKg: number;
  readonly types: readonly string[];
  readonly stats: BaseStats;
  readonly evolution: Evolution;
  /** 姿の識別子。別名の確認に使う。 */
  readonly varieties: readonly string[];
};

/** 図鑑の説明文を見ずに、独自の文章で書くデータ。 */
export type HandWritten = {
  readonly appearance: string;
  readonly signature: string;
  readonly aliases: readonly string[];
  /** 生成した文が検証を通らないときに、ヒント番号を指定して置き換える。 */
  readonly overrides?: Readonly<Record<string, string>>;
};

export type BuiltQuestion = {
  readonly number: number;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly hints: readonly string[];
};

export class MissingHandWrittenError extends Error {
  constructor(number: number) {
    super(`手書きデータがありません: ${number}`);
    this.name = "MissingHandWrittenError";
  }
}

const STAT_LABELS: readonly (readonly [keyof BaseStats, string])[] = [
  ["hp", "HP"],
  ["attack", "攻撃"],
  ["defense", "防御"],
  ["specialAttack", "特攻"],
  ["specialDefense", "特防"],
  ["speed", "素早さ"],
];

function highestStatHint(stats: BaseStats): string {
  const highest = Math.max(...STAT_LABELS.map(([key]) => stats[key]));
  const labels = STAT_LABELS.filter(([key]) => stats[key] === highest).map(
    ([, label]) => label,
  );
  if (labels.length === STAT_LABELS.length) {
    return "基礎能力がすべて同じ値のポケモンである。";
  }
  return `基礎能力では${labels.join("と")}が最も高いポケモンである。`;
}

function totalStatsHint(stats: BaseStats): string {
  const total = STAT_LABELS.reduce((sum, [key]) => sum + stats[key], 0);
  return `基礎能力の合計は ${total} である。`;
}

function typeHint(types: readonly string[]): string {
  return types.length === 1
    ? `タイプは${types[0]}のみである。`
    : `タイプは${types.join("と")}である。`;
}

function evolutionHint({ stepsBefore, stepsAfter, branches }: Evolution) {
  const split = branches > 1 ? `、進化先は ${branches} 種類に分かれる` : "";
  if (stepsBefore === 0 && stepsAfter === 0) {
    return "進化しないポケモンである。";
  }
  if (stepsAfter === 0) {
    return `${stepsBefore} 回の進化を経た最終段階の姿である。`;
  }
  if (stepsBefore === 0) {
    return branches > 1
      ? `${stepsAfter} 回進化し${split}ポケモンである。`
      : `${stepsAfter} 回進化するポケモンである。`;
  }
  return branches > 1
    ? `${stepsBefore} 回進化した姿で、あと ${stepsAfter} 回進化し${split}段階である。`
    : `${stepsBefore} 回進化した姿で、あと ${stepsAfter} 回進化する段階である。`;
}

function nameHint(name: string): string {
  const characters = [...name.normalize("NFC")];
  return `名前は ${characters.length} 文字で、頭文字は「${characters[0]}」である。`;
}

/** 事実と手書きデータから、難しい順に 10 個のヒントを持つ問題を作る。 */
export function buildQuestion(
  facts: SpeciesFacts,
  handWritten: HandWritten | undefined,
): BuiltQuestion {
  if (handWritten === undefined) {
    throw new MissingHandWrittenError(facts.number);
  }
  const hints = [
    highestStatHint(facts.stats),
    totalStatsHint(facts.stats),
    `高さは ${facts.heightM.toFixed(1)} m である。`,
    `重さは ${facts.weightKg.toFixed(1)} kg である。`,
    `初めて登場したのは第 ${facts.generation} 世代である。`,
    handWritten.appearance,
    typeHint(facts.types),
    evolutionHint(facts.evolution),
    handWritten.signature,
    nameHint(facts.name),
  ];
  return {
    number: facts.number,
    name: facts.name,
    aliases: handWritten.aliases,
    hints: hints.map(
      (hint, index) => handWritten.overrides?.[String(index + 1)] ?? hint,
    ),
  };
}
