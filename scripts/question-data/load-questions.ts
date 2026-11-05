import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type BuiltQuestion,
  buildQuestion,
  type HandWritten,
  type SpeciesFacts,
} from "./build-question.ts";

async function readGenerationFiles<T>(directory: string): Promise<T[]> {
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
  const handWritten: Record<string, HandWritten> = Object.assign(
    {},
    ...handWrittenFiles,
  );
  return factFiles
    .flat()
    .sort((a, b) => a.number - b.number)
    .map((facts) => buildQuestion(facts, handWritten[String(facts.number)]));
}
