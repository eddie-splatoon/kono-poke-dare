import { describe, expect, it } from "vitest";
import { validateQuestion } from "@/domain/game/validate-question";
import {
  buildQuestion,
  type HandWritten,
  InvalidOverrideError,
  MissingHandWrittenError,
  type SpeciesFacts,
} from "./build-question.ts";

const facts: SpeciesFacts = {
  number: 1,
  name: "カセツモン",
  generation: 3,
  heightM: 0.7,
  weightKg: 100,
  types: ["くさ", "どく"],
  stats: {
    hp: 45,
    attack: 49,
    defense: 49,
    specialAttack: 65,
    specialDefense: 60,
    speed: 45,
  },
  evolution: { stepsBefore: 0, stepsAfter: 0, branches: 0 },
  varieties: ["kasetsumon"],
};

const handWritten: HandWritten = {
  appearance: "背中に大きな袋を背負っている姿である。",
  signature: "夜になると光る姿が知られている種族である。",
  aliases: ["メガカセツモン"],
};

function hintOf(number: number, overrides: Partial<SpeciesFacts> = {}) {
  const question = buildQuestion({ ...facts, ...overrides }, handWritten);
  return question.hints[number - 1];
}

function evolutionHint(
  stepsBefore: number,
  stepsAfter: number,
  branches: number,
) {
  return hintOf(8, { evolution: { stepsBefore, stepsAfter, branches } });
}

describe("buildQuestion", () => {
  it("R-1: 生成した問題が検証を通る", () => {
    expect(validateQuestion(buildQuestion(facts, handWritten))).toEqual([]);
  });

  it("R-38: ヒント 1 は最も高い基礎能力を示す", () => {
    expect(hintOf(1)).toBe("基礎能力では特攻が最も高いポケモンである。");
  });

  it("R-39: ヒント 1 は同値の基礎能力を併記する", () => {
    expect(
      hintOf(1, {
        stats: { ...facts.stats, specialAttack: 65, specialDefense: 65 },
      }),
    ).toBe("基礎能力では特攻と特防が最も高いポケモンである。");
    expect(
      hintOf(1, {
        stats: {
          hp: 100,
          attack: 100,
          defense: 100,
          specialAttack: 60,
          specialDefense: 60,
          speed: 60,
        },
      }),
    ).toBe("基礎能力ではHPと攻撃と防御が最も高いポケモンである。");
  });

  it("R-40: ヒント 1 は 6 つの基礎能力がすべて同じならそのことを示す", () => {
    expect(
      hintOf(1, {
        stats: {
          hp: 100,
          attack: 100,
          defense: 100,
          specialAttack: 100,
          specialDefense: 100,
          speed: 100,
        },
      }),
    ).toBe("基礎能力がすべて同じ値のポケモンである。");
  });

  it("R-41: ヒント 2 は基礎能力の合計を示す", () => {
    expect(hintOf(2)).toBe("基礎能力の合計は 313 である。");
  });

  it("R-42: ヒント 3 と 4 は高さと重さを小数 1 桁で示す", () => {
    expect(hintOf(3)).toBe("高さは 0.7 m である。");
    expect(hintOf(4)).toBe("重さは 100.0 kg である。");
  });

  it("R-43: ヒント 5 は初登場の世代を示す", () => {
    expect(hintOf(5)).toBe("初めて登場したのは第 3 世代である。");
  });

  it("R-44: ヒント 6 と 9 は手書きの文をそのまま使う", () => {
    expect(hintOf(6)).toBe(handWritten.appearance);
    expect(hintOf(9)).toBe(handWritten.signature);
  });

  it("R-45: ヒント 7 は 2 つのタイプを示す", () => {
    expect(hintOf(7)).toBe("タイプはくさとどくである。");
  });

  it("R-46: ヒント 7 はタイプが 1 つならそのことを示す", () => {
    expect(hintOf(7, { types: ["ほのお"] })).toBe("タイプはほのおのみである。");
  });

  it("R-47: ヒント 8 は進化しない種族ではそのことを示す", () => {
    expect(evolutionHint(0, 0, 0)).toBe("進化しないポケモンである。");
  });

  it("R-48: ヒント 8 は最初の段階では進化できる回数を示す", () => {
    expect(evolutionHint(0, 2, 1)).toBe("2 回進化するポケモンである。");
  });

  it("R-49: ヒント 8 は途中の段階では経た回数と残りの回数を示す", () => {
    expect(evolutionHint(1, 1, 1)).toBe(
      "1 回進化した姿で、あと 1 回進化する段階である。",
    );
  });

  it("R-50: ヒント 8 は最終段階では経た回数を示す", () => {
    expect(evolutionHint(2, 0, 0)).toBe("2 回の進化を経た最終段階の姿である。");
  });

  it("R-51: ヒント 8 は進化先が分かれるときはその数を示す", () => {
    expect(evolutionHint(0, 1, 8)).toBe(
      "1 回進化し、進化先は 8 種類に分かれるポケモンである。",
    );
    expect(evolutionHint(1, 1, 2)).toBe(
      "1 回進化した姿で、あと 1 回進化し、進化先は 2 種類に分かれる段階である。",
    );
  });

  it("R-52: ヒント 10 は名前の文字数と頭文字を示す", () => {
    expect(hintOf(10)).toBe("名前は 5 文字で、頭文字は「カ」である。");
    expect(hintOf(10, { name: "ニドラン♀" })).toBe(
      "名前は 5 文字で、頭文字は「ニ」である。",
    );
  });

  it("R-53: overrides は指定したヒントだけを置き換える", () => {
    const question = buildQuestion(facts, {
      ...handWritten,
      overrides: { 7: "置き換えた文である。" },
    });
    const original = buildQuestion(facts, handWritten);
    expect(question.hints[6]).toBe("置き換えた文である。");
    expect(question.hints.filter((_, i) => i !== 6)).toEqual(
      original.hints.filter((_, i) => i !== 6),
    );
  });

  it.each(["0", "11", "１０", "1.5"])(
    "R-68: overrides のキー %s はエラーにする",
    (key) => {
      expect(() =>
        buildQuestion(facts, {
          ...handWritten,
          overrides: { [key]: "置き換えた文である。" },
        }),
      ).toThrow(InvalidOverrideError);
    },
  );

  it("R-54: 手書きデータが欠けていればエラーにする", () => {
    expect(() => buildQuestion(facts, undefined)).toThrow(
      MissingHandWrittenError,
    );
  });

  it("R-64: 番号、名前、別名を問題に写す", () => {
    const question = buildQuestion(facts, handWritten);
    expect(question.number).toBe(1);
    expect(question.name).toBe("カセツモン");
    expect(question.aliases).toEqual(["メガカセツモン"]);
  });
});
