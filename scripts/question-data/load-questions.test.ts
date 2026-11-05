import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DuplicateSourceError, loadQuestions } from "./load-questions.ts";

function makeFacts(number: number) {
  return {
    number,
    name: `カセツモン${number}`,
    generation: 1,
    heightM: 1,
    weightKg: 1,
    types: ["くさ"],
    stats: {
      hp: 1,
      attack: 2,
      defense: 3,
      specialAttack: 4,
      specialDefense: 5,
      speed: 6,
    },
    evolution: { stepsBefore: 0, stepsAfter: 0, branches: 0 },
    varieties: [],
  };
}

const handWritten = {
  appearance: "外見の文である。",
  signature: "特徴の文である。",
  aliases: [],
};

describe("loadQuestions", () => {
  let directory: string;

  async function write(path: string, content: unknown) {
    await writeFile(join(directory, path), JSON.stringify(content));
  }

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "question-sources-"));
    await mkdir(join(directory, "facts"));
    await mkdir(join(directory, "hand-written"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("R-65: 複数の世代のファイルを読み、番号順の問題にする", async () => {
    await write("facts/gen-2.json", [makeFacts(2)]);
    await write("facts/gen-1.json", [makeFacts(1)]);
    await write("hand-written/gen-1.json", { 1: handWritten });
    await write("hand-written/gen-2.json", { 2: handWritten });

    const questions = await loadQuestions(directory);

    expect(questions.map(({ number }) => number)).toEqual([1, 2]);
  });

  it("R-66: 事実の番号が重複していればエラーにする", async () => {
    await write("facts/gen-1.json", [makeFacts(1)]);
    await write("facts/gen-2.json", [makeFacts(1)]);
    await write("hand-written/gen-1.json", { 1: handWritten });

    await expect(loadQuestions(directory)).rejects.toThrow(
      DuplicateSourceError,
    );
  });

  it("R-67: 手書きデータの番号が重複していればエラーにする", async () => {
    await write("facts/gen-1.json", [makeFacts(1)]);
    await write("hand-written/gen-1.json", { 1: handWritten });
    await write("hand-written/gen-2.json", { 1: handWritten });

    await expect(loadQuestions(directory)).rejects.toThrow(
      DuplicateSourceError,
    );
  });
});
