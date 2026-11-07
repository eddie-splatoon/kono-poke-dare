import { join } from "node:path";
import type {
  BuiltQuestion,
  SpeciesFacts,
} from "../question-data/build-question.ts";
import {
  loadQuestions,
  readGenerationFiles,
} from "../question-data/load-questions.ts";
import { hintsVersion } from "./sheet-client.js";

export type ReviewEntry = BuiltQuestion & {
  readonly generation: number;
  readonly version: string;
  /** 優先の種族の、疑いの内容。 */
  readonly note?: string;
};

export class UnknownPriorityNameError extends Error {
  constructor(name: string) {
    super(`優先の種族の名前がデータにありません: ${name}`);
    this.name = "UnknownPriorityNameError";
  }
}

/** 問題に、世代、ヒントの版、優先の内容を付ける。 */
export function buildReviewEntries(
  questions: readonly BuiltQuestion[],
  generations: ReadonlyMap<number, number>,
  notes: Readonly<Record<string, string>>,
): ReviewEntry[] {
  const names = new Set(questions.map(({ name }) => name));
  for (const name of Object.keys(notes)) {
    if (!names.has(name)) {
      throw new UnknownPriorityNameError(name);
    }
  }
  return questions.map((question) => {
    const note = Object.hasOwn(notes, question.name)
      ? notes[question.name]
      : undefined;
    return {
      ...question,
      generation: generations.get(question.number) as number,
      version: hintsVersion(question.hints),
      ...(note === undefined ? {} : { note }),
    };
  });
}

/** data/question-sources/ から評価シートの種族を読み込む。 */
export async function loadReviewEntries(
  sourceDirectory: string,
  notes: Readonly<Record<string, string>>,
): Promise<ReviewEntry[]> {
  const factFiles = await readGenerationFiles<SpeciesFacts[]>(
    join(sourceDirectory, "facts"),
  );
  const generations = new Map(
    factFiles.flat().map(({ number, generation }) => [number, generation]),
  );
  return buildReviewEntries(
    await loadQuestions(sourceDirectory),
    generations,
    notes,
  );
}
