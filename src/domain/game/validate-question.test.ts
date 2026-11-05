import { describe, expect, it } from "vitest";
import {
  validateQuestion,
  validateQuestionManifest,
  validateQuestionSet,
} from "./validate-question";

const validHints = Array.from(
  { length: 10 },
  (_, i) => `ヒントの本文その${i + 1}`,
);

const validQuestion = {
  number: 7,
  name: "カセツモン",
  aliases: ["メガカセツモン"],
  hints: validHints,
};

function hintsWith(hint: string): string[] {
  return [hint, ...validHints.slice(1)];
}

describe("validateQuestion", () => {
  it("R-1: 形式を満たす問題は問題点が 0 件になる", () => {
    expect(validateQuestion(validQuestion)).toEqual([]);
  });

  it("R-1: 別名は空でもよい", () => {
    expect(validateQuestion({ ...validQuestion, aliases: [] })).toEqual([]);
  });

  it.each([null, undefined, 1, "問題", []])(
    "R-2: オブジェクトでない値 %j は問題点になる",
    (value) => {
      expect(validateQuestion(value)).not.toEqual([]);
    },
  );

  it.each([0, -1, 1.5, "1", null, Number.NaN])(
    "R-3: number が %j なら問題点になる",
    (number) => {
      expect(validateQuestion({ ...validQuestion, number })).not.toEqual([]);
    },
  );

  it.each([1, null, undefined])("R-4: name が %j なら問題点になる", (name) => {
    expect(validateQuestion({ ...validQuestion, name })).not.toEqual([]);
  });

  it.each(["", "  ", "・"])("R-5: name が %j なら問題点になる", (name) => {
    expect(validateQuestion({ ...validQuestion, name })).not.toEqual([]);
  });

  it.each([null, "ベツメイ", [1], [null]])(
    "R-6: aliases が %j なら問題点になる",
    (aliases) => {
      expect(validateQuestion({ ...validQuestion, aliases })).not.toEqual([]);
    },
  );

  it.each(["", " ", ":"])("R-7: 別名が %j なら問題点になる", (alias) => {
    expect(
      validateQuestion({ ...validQuestion, aliases: [alias] }),
    ).not.toEqual([]);
  });

  it.each([null, "ヒント", [...validHints.slice(1), 1]])(
    "R-8: hints が %j なら問題点になる",
    (hints) => {
      expect(validateQuestion({ ...validQuestion, hints })).not.toEqual([]);
    },
  );

  it.each(["", "  ", "・"])("R-9: ヒントが %j なら問題点になる", (hint) => {
    expect(
      validateQuestion({ ...validQuestion, hints: hintsWith(hint) }),
    ).not.toEqual([]);
  });

  it.each([0, 9, 11])("R-10: ヒントが %i 個なら問題点になる", (length) => {
    const hints = Array.from({ length }, (_, i) => `本文その${i + 1}`);

    expect(validateQuestion({ ...validQuestion, hints })).not.toEqual([]);
  });

  it("R-11: 正規化して同じになるヒントは問題点になる", () => {
    const hints = [...validHints.slice(0, 9), ` ${validHints[0]}`];

    expect(validateQuestion({ ...validQuestion, hints })).not.toEqual([]);
  });

  it("R-12: 別の問題と同じ文のヒントは問題点にならない", () => {
    const other = { ...validQuestion, number: 8, name: "ベツノモン" };

    expect(validateQuestion(validQuestion)).toEqual([]);
    expect(validateQuestion({ ...other, aliases: [] })).toEqual([]);
  });

  it.each(["正解はカセツモンである", "かせつもんの仲間である", "カセツ モン"])(
    "R-13: ヒント %j は name を含むので問題点になる",
    (hint) => {
      expect(
        validateQuestion({ ...validQuestion, hints: hintsWith(hint) }),
      ).not.toEqual([]);
    },
  );

  it("R-14: ヒントに別名が含まれると問題点になる", () => {
    const question = { ...validQuestion, aliases: ["ベツメイ"] };

    expect(
      validateQuestion({ ...question, hints: hintsWith("べつめいと呼ばれる") }),
    ).not.toEqual([]);
  });

  it.each([[["かせつもん"]], [["ベツメイ", "べつめい"]]])(
    "R-15: 別名 %j は重複するので問題点になる",
    (aliases) => {
      expect(validateQuestion({ ...validQuestion, aliases })).not.toEqual([]);
    },
  );

  it("R-16: 問題点をすべて返す", () => {
    const issues = validateQuestion({
      number: 0,
      name: 1,
      aliases: null,
      hints: ["同じ", "同じ"],
    });

    expect(issues.length).toBeGreaterThanOrEqual(5);
  });

  it("R-17: メッセージに問題番号を含める", () => {
    const issues = validateQuestion({
      ...validQuestion,
      hints: hintsWith("カセツモン"),
    });

    expect(issues).not.toEqual([]);
    for (const issue of issues) {
      expect(issue).toContain("問題 7");
    }
  });
});

describe("validateQuestionSet", () => {
  it("R-18: 1〜期待する問題数で揃っていれば問題点が 0 件になる", () => {
    expect(validateQuestionSet([3, 1, 2], 3)).toEqual([]);
  });

  it("R-19: 欠番は問題点になる", () => {
    const issues = validateQuestionSet([1, 3], 3);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("2");
  });

  it("R-19: 問題が 1 つもなければすべて欠番になる", () => {
    expect(validateQuestionSet([], 2)).toHaveLength(2);
  });

  it.each([[[1, 2, 3, 4]], [[0, 1, 2, 3]], [[1, 2, 3, 3]]])(
    "R-20: 問題番号 %j は問題点になる",
    (numbers) => {
      expect(validateQuestionSet(numbers, 3)).toHaveLength(1);
    },
  );
});

describe("validateQuestionManifest", () => {
  it("R-21: count が 1 以上の整数なら問題点が 0 件になる", () => {
    expect(validateQuestionManifest({ count: 1 })).toEqual([]);
  });

  it.each([null, [], {}, { count: 0 }, { count: 1.5 }, { count: "1" }])(
    "R-21: %j は問題点になる",
    (value) => {
      expect(validateQuestionManifest(value)).not.toEqual([]);
    },
  );
});
