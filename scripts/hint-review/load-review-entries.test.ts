import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildReviewEntries,
  loadReviewEntries,
  UnknownPriorityNameError,
} from "./load-review-entries.ts";
import { PRIORITY_NOTES } from "./priority-notes.ts";

const QUESTIONS = [
  { number: 1, name: "カセツモン", aliases: [], hints: ["a"] },
  { number: 2, name: "カリモン", aliases: ["メガカリモン"], hints: ["b"] },
];
const FACTS = new Map([
  [1, 3],
  [2, 4],
]);

describe("buildReviewEntries", () => {
  it("R-34: 種族に世代と優先の内容を付ける", () => {
    const [first, second] = buildReviewEntries(QUESTIONS, FACTS, {
      カリモン: "角の本数に疑い",
    });
    expect(first).toMatchObject({ number: 1, generation: 3 });
    expect(first).not.toHaveProperty("note");
    expect(second).toMatchObject({
      generation: 4,
      aliases: ["メガカリモン"],
      note: "角の本数に疑い",
    });
    expect(second.version).toMatch(/^v[0-9a-f]{8}$/);
  });

  it("R-35: 優先の種族の名前がデータになければエラーにする", () => {
    expect(() =>
      buildReviewEntries(QUESTIONS, FACTS, { ソンザイシナイ: "疑い" }),
    ).toThrow(UnknownPriorityNameError);
  });
});

describe("実データ", () => {
  it("R-36: 配信データと同じヒントを持つ全 1025 種を読み込む", async () => {
    const entries = await loadReviewEntries(
      join("data", "question-sources"),
      PRIORITY_NOTES,
    );
    expect(entries).toHaveLength(1025);
    expect(entries.filter(({ note }) => note !== undefined).length).toBe(
      Object.keys(PRIORITY_NOTES).length,
    );
    for (const entry of [entries[0], entries[499], entries[1024]]) {
      const fileName = `${String(entry.number).padStart(4, "0")}.json`;
      const delivered = JSON.parse(
        await readFile(join("public/data/questions", fileName), "utf8"),
      );
      expect(entry.hints).toEqual(delivered.hints);
    }
  });
});
