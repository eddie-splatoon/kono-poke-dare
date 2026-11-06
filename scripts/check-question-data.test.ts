import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkQuestionData } from "./check-question-data";
import { loadQuestions } from "./question-data/load-questions.ts";

/** 世代ごとに増やし、全種類のデータが完成したら(#16)、1025 にする。 */
const EXPECTED_QUESTION_COUNT = 151;

const PUBLIC_DIRECTORY = fileURLToPath(
  new URL("../public/data/questions", import.meta.url),
);
const SOURCE_DIRECTORY = fileURLToPath(
  new URL("../data/question-sources", import.meta.url),
);

function makeQuestion(number: number) {
  return {
    number,
    name: `カセツモン${number}`,
    aliases: [],
    hints: Array.from({ length: 10 }, (_, i) => `ヒントの本文その${i + 1}`),
  };
}

const fileNameOf = (number: number) =>
  `${String(number).padStart(4, "0")}.json`;

describe("配信するデータ", () => {
  it("R-31: 検証の問題点が 0 件である", async () => {
    await expect(
      checkQuestionData(PUBLIC_DIRECTORY, EXPECTED_QUESTION_COUNT),
    ).resolves.toEqual([]);
  });

  it("R-69: ソースから生成した問題と一致する", async () => {
    const questions = await loadQuestions(SOURCE_DIRECTORY);

    expect(questions).toHaveLength(EXPECTED_QUESTION_COUNT);
    for (const question of questions) {
      const published = JSON.parse(
        await readFile(
          join(PUBLIC_DIRECTORY, fileNameOf(question.number)),
          "utf8",
        ),
      );
      expect(published).toEqual(question);
    }
  });
});

describe("checkQuestionData", () => {
  let directory: string;

  async function write(fileName: string, content: unknown) {
    await writeFile(
      join(directory, fileName),
      typeof content === "string" ? content : JSON.stringify(content),
    );
  }

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "question-data-"));
    await write("index.json", { count: 2 });
    await write(fileNameOf(1), makeQuestion(1));
    await write(fileNameOf(2), makeQuestion(2));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("R-31: 正しいデータでは問題点が 0 件である", async () => {
    await expect(checkQuestionData(directory, 2)).resolves.toEqual([]);
  });

  it("R-32: ヒントが 9 個のファイルを検出する", async () => {
    const question = makeQuestion(1);
    await write(fileNameOf(1), {
      ...question,
      hints: question.hints.slice(1),
    });

    const issues = await checkQuestionData(directory, 2);

    expect(issues.join("\n")).toContain(fileNameOf(1));
  });

  it("R-32: ヒントの重複を検出する", async () => {
    const question = makeQuestion(1);
    await write(fileNameOf(1), {
      ...question,
      hints: [...question.hints.slice(1), question.hints[1]],
    });

    await expect(checkQuestionData(directory, 2)).resolves.not.toEqual([]);
  });

  it("R-32: ヒントへの名前の混入を検出する", async () => {
    const question = makeQuestion(1);
    await write(fileNameOf(1), {
      ...question,
      hints: [question.name, ...question.hints.slice(1)],
    });

    await expect(checkQuestionData(directory, 2)).resolves.not.toEqual([]);
  });

  it("R-33: 欠番を検出する", async () => {
    await rm(join(directory, fileNameOf(2)));

    await expect(checkQuestionData(directory, 2)).resolves.not.toEqual([]);
  });

  it("R-33: 問題数を超える番号のファイルを検出する", async () => {
    await write(fileNameOf(3), makeQuestion(3));

    await expect(checkQuestionData(directory, 2)).resolves.not.toEqual([]);
  });

  it("R-33: 命名規則に合わないファイルを検出する", async () => {
    await write("memo.txt", "下書き");

    const issues = await checkQuestionData(directory, 2);

    expect(issues.join("\n")).toContain("memo.txt");
  });

  it("R-34: JSON として読めないファイルを検出する", async () => {
    await write(fileNameOf(1), "{ 壊れた JSON");

    const issues = await checkQuestionData(directory, 2);

    expect(issues.join("\n")).toContain(fileNameOf(1));
  });

  it("R-34: JSON として読めない index.json を検出する", async () => {
    await write("index.json", "{ 壊れた JSON");

    const issues = await checkQuestionData(directory, 2);

    expect(issues.join("\n")).toContain("index.json");
  });

  it("R-35: ファイル名と number の不一致を検出する", async () => {
    await write(fileNameOf(1), makeQuestion(2));

    await expect(checkQuestionData(directory, 2)).resolves.not.toEqual([]);
  });

  it("R-36: count と期待する問題数の不一致を検出する", async () => {
    await write("index.json", { count: 1 });

    await expect(checkQuestionData(directory, 2)).resolves.not.toEqual([]);
  });

  it("R-36: 揃っていても、期待する問題数に足りなければ検出する", async () => {
    await expect(checkQuestionData(directory, 3)).resolves.not.toEqual([]);
  });
});
