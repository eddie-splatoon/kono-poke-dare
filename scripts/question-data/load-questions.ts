import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type BuiltQuestion,
  buildQuestion,
  type HandWritten,
  type SpeciesFacts,
} from "./build-question.ts";

export class DuplicateSourceError extends Error {
  constructor(kind: string, number: string) {
    super(`${kind}の番号が重複しています: ${number}`);
    this.name = "DuplicateSourceError";
  }
}

export async function readGenerationFiles<T>(directory: string): Promise<T[]> {
  const fileNames = (await readdir(directory)).filter((name) =>
    /^gen-\d+\.json$/.test(name),
  );
  return Promise.all(
    fileNames.map(
      async (name) =>
        JSON.parse(await readFile(join(directory, name), "utf8")) as T,
    ),
  );
}

/** data/question-sources/ の事実と手書きデータから、番号順の問題を作る。 */
export async function loadQuestions(
  sourceDirectory: string,
): Promise<BuiltQuestion[]> {
  const factFiles = await readGenerationFiles<SpeciesFacts[]>(
    join(sourceDirectory, "facts"),
  );
  const handWrittenFiles = await readGenerationFiles<
    Record<string, HandWritten>
  >(join(sourceDirectory, "hand-written"));
  const handWritten = new Map<string, HandWritten>();
  for (const [number, entry] of handWrittenFiles.flatMap((file) =>
    Object.entries(file),
  )) {
    if (handWritten.has(number)) {
      throw new DuplicateSourceError("手書きデータ", number);
    }
    handWritten.set(number, entry);
  }

  const facts = factFiles.flat().sort((a, b) => a.number - b.number);
  for (const [index, { number }] of facts.entries()) {
    if (facts[index - 1]?.number === number) {
      throw new DuplicateSourceError("事実", String(number));
    }
  }
  return facts.map((entry) =>
    buildQuestion(entry, handWritten.get(String(entry.number))),
  );
}
