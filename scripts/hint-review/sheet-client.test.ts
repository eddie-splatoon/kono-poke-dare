import { describe, expect, it } from "vitest";
import { CRITERIA } from "./criteria.ts";
import {
  applyScore,
  buildCsv,
  filterEntries,
  guardCell,
  hintsVersion,
  importCsv,
  nextTarget,
  parseCsv,
  progressOf,
  restoreState,
  scoreFromKey,
  serializeState,
  summarizeRecord,
} from "./sheet-client.js";

const IDS = CRITERIA.map(({ id }) => id);

function hints(prefix: string): string[] {
  return Array.from({ length: 10 }, (_, i) => `${prefix}のヒント${i + 1}`);
}

function entry(number: number, generation: number, note?: string) {
  const entryHints = hints(`架空${number}`);
  return {
    number,
    name: `カセツモン${number}`,
    aliases: [],
    generation,
    hints: entryHints,
    version: hintsVersion(entryHints),
    ...(note === undefined ? {} : { note }),
  };
}

const ENTRIES = [entry(1, 1), entry(2, 1, "角の本数に疑い"), entry(3, 2)];
const [FIRST, SECOND, THIRD] = ENTRIES;

function record(
  target: { version: string },
  values: readonly (number | "NA")[],
  comment = "",
) {
  return {
    version: target.version,
    scores: Object.fromEntries(values.map((value, i) => [IDS[i], value])),
    comment,
  };
}

function csvRows(text: string): string[][] {
  return parseCsv(text);
}

describe("hintsVersion", () => {
  it("R-1: 同じヒントなら同じ値に、1 つでも異なれば異なる値になる", () => {
    const changed = [...hints("架空")];
    changed[5] = "別の文";
    expect(hintsVersion(hints("架空"))).toBe(hintsVersion(hints("架空")));
    expect(hintsVersion(changed)).not.toBe(hintsVersion(hints("架空")));
    expect(hintsVersion(hints("架空"))).toMatch(/^v[0-9a-f]{8}$/);
  });
});

describe("summarizeRecord", () => {
  it("R-8: NA の観点は total と min_score から除外する", () => {
    expect(
      summarizeRecord(record(FIRST, [5, "NA", 3, 4, "NA", 5]), IDS),
    ).toMatchObject({ total: 17, minScore: 3, complete: true });
  });

  it("R-43: 3 以下の評点があればコメントを求める", () => {
    expect(summarizeRecord(record(FIRST, [4, 5]), IDS).needsComment).toBe(
      false,
    );
    expect(summarizeRecord(record(FIRST, [4, "NA"]), IDS).needsComment).toBe(
      false,
    );
    const middle = summarizeRecord(record(FIRST, [4, 3]), IDS);
    expect(middle.needsComment).toBe(true);
    expect(middle.needsFix).toBe(false);
  });

  it("R-9: いずれかの評点が 2 以下なら要修正になる", () => {
    expect(summarizeRecord(record(FIRST, [3, 3]), IDS).needsFix).toBe(false);
    expect(summarizeRecord(record(FIRST, [3, 2]), IDS).needsFix).toBe(true);
  });

  it("R-10: 数値の評点が 1 つもなければ total と min_score が空になる", () => {
    expect(summarizeRecord(record(FIRST, ["NA"]), IDS)).toMatchObject({
      total: null,
      minScore: null,
      needsFix: false,
      complete: false,
    });
  });
});

describe("buildCsv", () => {
  it("R-2: 列を定めた順に並べる", () => {
    expect(csvRows(buildCsv(ENTRIES, IDS, new Map()))[0]).toEqual([
      "number",
      "name",
      "generation",
      "priority",
      "hints_version",
      "accuracy",
      "hint8_strength",
      "hint9_strength",
      "difficulty_order",
      "wording",
      "redundancy",
      "total",
      "min_score",
      "needs_fix",
      "comment",
      "hint_8",
      "hint_9",
    ]);
  });

  it("R-3: 評点またはコメントがある種族の行だけを含む", () => {
    const state = new Map([
      [1, record(FIRST, [5])],
      [2, record(SECOND, [])],
      [3, record(THIRD, [], "メモ")],
    ]);
    const rows = csvRows(buildCsv(ENTRIES, IDS, state));
    expect(rows.slice(1).map(([number]) => number)).toEqual(["1", "3"]);
  });

  it("R-4: BOM で始まり、行末が CRLF である", () => {
    const csv = buildCsv(ENTRIES, IDS, new Map([[1, record(FIRST, [5])]]));
    expect(csv.startsWith("﻿number,")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
  });

  it("R-5: カンマ、引用符、改行を含むセルを引用する", () => {
    const state = new Map([[1, record(FIRST, [5], 'a,"b"\nc')]]);
    expect(buildCsv(ENTRIES, IDS, state)).toContain('"a,""b""\nc"');
  });

  it("R-6: 数式として解釈されるセルに ' を前置する", () => {
    for (const value of ["=1+1", "+1", "-1", "@A1", "\t=1", " =1", "＝1"]) {
      expect(guardCell(value)).toBe(`'${value}`);
    }
    expect(guardCell("通常の文")).toBe("通常の文");
    const state = new Map([[1, record(FIRST, [5], "=HYPERLINK(1)")]]);
    expect(buildCsv(ENTRIES, IDS, state)).toContain("'=HYPERLINK(1)");
  });
});

describe("parseCsv", () => {
  it("R-7: 引用されたカンマ、引用符、改行を復元する", () => {
    expect(parseCsv('﻿a,b\r\n"1,2","x""y\nz"\r\n')).toEqual([
      ["a", "b"],
      ["1,2", 'x"y\nz'],
    ]);
  });

  it("R-16: 引用符が閉じていないとエラーになる", () => {
    expect(() => parseCsv('a,b\r\n"1,2')).toThrow();
  });
});

describe("importCsv", () => {
  function exported(state: Map<number, ReturnType<typeof record>>) {
    return buildCsv(ENTRIES, IDS, state);
  }

  it("R-11: 書き出した CSV を取り込むと評点とコメントが元に戻る", () => {
    const state = new Map([
      [1, record(FIRST, [5, "NA", 3, 1, 2], "=数式,と\n改行")],
      [2, record(SECOND, [], "'=前置つきの文")],
      [3, record(THIRD, [4])],
    ]);
    const result = importCsv(exported(state), ENTRIES, IDS);
    expect(result.records).toEqual(state);
    expect(result).toMatchObject({ imported: 3, invalid: 0, stale: 0 });
  });

  it("R-12: 必要な列がない CSV はエラーになる", () => {
    expect(() => importCsv("number,name\r\n1,x\r\n", ENTRIES, IDS)).toThrow();
    expect(() => importCsv("", ENTRIES, IDS)).toThrow();
  });

  it("R-13: 範囲外の評点がある行は採用せず invalid に数える", () => {
    const csv = exported(new Map([[1, record(FIRST, [5])]]));
    for (const bad of ["0", "6", "2.5", "abc"]) {
      const edited = csv.replace(
        `${FIRST.version},5,`,
        `${FIRST.version},${bad},`,
      );
      expect(importCsv(edited, ENTRIES, IDS)).toMatchObject({
        imported: 0,
        invalid: 1,
      });
    }
  });

  it("R-14: 存在しない番号の行は採用せず invalid に数える", () => {
    const csv = exported(new Map([[1, record(FIRST, [5])]]));
    for (const bad of ["999", "__proto__", "1.5"]) {
      const result = importCsv(
        csv.replace("\r\n1,", `\r\n${bad},`),
        ENTRIES,
        IDS,
      );
      expect(result).toMatchObject({ imported: 0, invalid: 1 });
      expect(result.records.size).toBe(0);
    }
  });

  it("R-15: hints_version が異なる行は採用せず stale に数える", () => {
    const csv = exported(new Map([[1, record(FIRST, [5])]]));
    const result = importCsv(
      csv.replace(FIRST.version, "v00000000"),
      ENTRIES,
      IDS,
    );
    expect(result).toMatchObject({ imported: 0, invalid: 0, stale: 1 });
  });
});

describe("restoreState", () => {
  it("R-17: JSON として読めない保存値は採点なしとして扱う", () => {
    for (const raw of [null, "{", "[]", '{"records":1}', "null"]) {
      const { state, stale } = restoreState(raw, ENTRIES, IDS);
      expect(state.size).toBe(0);
      expect(stale).toBe(0);
    }
  });

  it("R-18: 正しい保存値から採点を復元する", () => {
    const state = new Map([[1, record(FIRST, [5, "NA"], "メモ")]]);
    expect(restoreState(serializeState(state), ENTRIES, IDS)).toEqual({
      state,
      stale: 0,
    });
  });

  it("R-19: 保存値の中の不正な評点は採用しない", () => {
    const raw = JSON.stringify({
      records: {
        "1": {
          version: FIRST.version,
          scores: { accuracy: 9, wording: 4, unknown: 5 },
          comment: 1,
        },
        "999": { version: "v0", scores: {}, comment: "" },
        "2": "壊れた値",
      },
    });
    const { state } = restoreState(raw, ENTRIES, IDS);
    expect([...state.keys()]).toEqual([1]);
    expect(state.get(1)).toEqual({
      version: FIRST.version,
      scores: { wording: 4 },
      comment: "",
    });
  });

  it("R-20: hints_version が異なる種族は採用せず stale に数える", () => {
    const state = new Map([[1, { ...record(FIRST, [5]), version: "v0" }]]);
    expect(restoreState(serializeState(state), ENTRIES, IDS)).toEqual({
      state: new Map(),
      stale: 1,
    });
  });
});

describe("filterEntries", () => {
  const state = new Map([
    [1, record(FIRST, [5, 5, 5, 5, 5, 5])],
    [2, record(SECOND, [1])],
  ]);
  const numbers = (filter: object) =>
    filterEntries(ENTRIES, state, IDS, filter).map(({ number }) => number);

  it("R-21: 世代で絞り込める", () => {
    expect(numbers({ generation: 2 })).toEqual([3]);
  });

  it("R-22: 全観点が揃っていない種族に絞り込める", () => {
    expect(numbers({ unscoredOnly: true })).toEqual([2, 3]);
  });

  it("R-23: 優先の種族に絞り込める", () => {
    expect(numbers({ priorityOnly: true })).toEqual([2]);
  });

  it("R-24: 要修正の種族に絞り込める", () => {
    expect(numbers({ needsFixOnly: true })).toEqual([2]);
  });
});

describe("progressOf", () => {
  it("R-25: 全観点が揃った種族の数を全体と世代ごとに返す", () => {
    const state = new Map([
      [1, record(FIRST, [5, 5, 5, 5, 5, "NA"])],
      [2, record(SECOND, [1])],
      [3, record(THIRD, [1, 5, 5, 5, 5, 5])],
    ]);
    expect(progressOf(ENTRIES, state, IDS)).toEqual({
      scored: 2,
      total: 3,
      needsFix: 2,
      byGeneration: [
        { generation: 1, scored: 1, total: 2 },
        { generation: 2, scored: 1, total: 1 },
      ],
    });
  });
});

describe("キーボード", () => {
  it("R-26: 1〜5 は次の未採点の観点をその評点にする", () => {
    expect(scoreFromKey("3")).toBe(3);
    expect(scoreFromKey("6")).toBeNull();
    expect(scoreFromKey("a")).toBeNull();
    const first = applyScore(undefined, FIRST.version, IDS, 3);
    expect(first.record.scores).toEqual({ accuracy: 3 });
    expect(first.complete).toBe(false);
    const second = applyScore(first.record, FIRST.version, IDS, 4);
    expect(second.record.scores).toEqual({ accuracy: 3, hint8_strength: 4 });
  });

  it("R-26: 最後の観点を埋めると complete になり、埋まっていれば変えない", () => {
    const almost = record(FIRST, [5, 5, 5, 5, 5]);
    const done = applyScore(almost, FIRST.version, IDS, 2);
    expect(done.complete).toBe(true);
    expect(done.record.scores.redundancy).toBe(2);
    expect(applyScore(done.record, FIRST.version, IDS, 5).record).toEqual(
      done.record,
    );
  });

  it("R-27: 0 は次の未採点の観点を NA にする", () => {
    expect(scoreFromKey("0")).toBe("NA");
    expect(
      applyScore(undefined, FIRST.version, IDS, scoreFromKey("0")).record
        .scores,
    ).toEqual({ accuracy: "NA" });
  });

  it("R-28: 今の番号より後の最初の種族とそのページを返す", () => {
    const list = Array.from({ length: 45 }, (_, i) => entry(i * 2 + 1, 1));
    expect(nextTarget(list, 1, 20)).toEqual({ number: 3, page: 0 });
    expect(nextTarget(list, 39, 20)).toEqual({ number: 41, page: 1 });
    // 絞り込みで今の種族が消えていても、続きから進める。
    expect(nextTarget(list, 40, 20)).toEqual({ number: 41, page: 1 });
    expect(nextTarget(list, 89, 20)).toBeNull();
  });
});
