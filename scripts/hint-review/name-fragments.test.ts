import { describe, expect, it } from "vitest";
import { findNameFragments, renderNameFragmentsCsv } from "./name-fragments.ts";

function species(number: number, name: string, overrides: [number, string][]) {
  const hints = Array.from({ length: 10 }, (_, i) => `文${i + 1}である。`);
  for (const [position, text] of overrides) {
    hints[position - 1] = text;
  }
  return { number, name, hints };
}

describe("findNameFragments", () => {
  it("R-47: ヒント 1〜9 に出ている、名前の 3 文字以上の最長の部分を返す", () => {
    expect(
      findNameFragments([
        species(752, "オニシズクモ", [[9, "シズクモが進化した姿である。"]]),
      ]),
    ).toEqual([
      { number: 752, name: "オニシズクモ", hint: 9, fragment: "シズクモ" },
    ]);
  });

  it("R-47: ヒントごとに報告し、番号順に並べる", () => {
    expect(
      findNameFragments([
        species(226, "マンタイン", [
          [8, "マンタの姿である。"],
          [9, "タマンタが進化した姿である。"],
        ]),
      ]),
    ).toEqual([
      { number: 226, name: "マンタイン", hint: 8, fragment: "マンタ" },
      { number: 226, name: "マンタイン", hint: 9, fragment: "マンタ" },
    ]);
  });

  it("R-47: 2 文字以下の一致とヒント 10 は報告しない", () => {
    expect(
      findNameFragments([
        species(1, "ミルタンク", [
          [9, "ミルクを出す種族である。"],
          [10, "名前はミルタンである。"],
        ]),
      ]),
    ).toEqual([]);
  });
});

describe("renderNameFragmentsCsv", () => {
  it("R-47: 見出しの行のあとに、1 件を 1 行で書き出す", () => {
    expect(
      renderNameFragmentsCsv([
        { number: 93, name: "ゴースト", hint: 9, fragment: "ゴース" },
      ]),
    ).toBe("﻿number,name,hint,fragment\r\n93,ゴースト,9,ゴース\r\n");
  });
});
