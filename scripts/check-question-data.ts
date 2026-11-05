import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  validateQuestion,
  validateQuestionManifest,
  validateQuestionSet,
} from "@/domain/game/validate-question";

const MANIFEST_FILE = "index.json";
const QUESTION_FILE = /^(\d{4})\.json$/;

type ParsedFile =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false };

async function readJsonFile(path: string): Promise<ParsedFile> {
  try {
    return { ok: true, value: JSON.parse(await readFile(path, "utf8")) };
  } catch {
    return { ok: false };
  }
}

async function checkManifest(
  directory: string,
  expectedCount: number,
): Promise<string[]> {
  const parsed = await readJsonFile(join(directory, MANIFEST_FILE));
  if (!parsed.ok) {
    return [`${MANIFEST_FILE}: JSON として読めません`];
  }
  const issues = validateQuestionManifest(parsed.value);
  if (issues.length > 0) {
    return issues.map((issue) => `${MANIFEST_FILE}: ${issue}`);
  }
  const { count } = parsed.value as { count: number };
  return count === expectedCount
    ? []
    : [
        `${MANIFEST_FILE}: count が期待する問題数 ${expectedCount} と異なります: ${count}`,
      ];
}

async function checkQuestionFile(
  directory: string,
  fileName: string,
  number: number,
): Promise<string[]> {
  const parsed = await readJsonFile(join(directory, fileName));
  if (!parsed.ok) {
    return [`${fileName}: JSON として読めません`];
  }
  const issues = validateQuestion(parsed.value).map(
    (issue) => `${fileName}: ${issue}`,
  );
  const actual = (parsed.value as { number?: unknown } | null)?.number;
  if (actual !== number) {
    issues.push(`${fileName}: number がファイル名と異なります: ${actual}`);
  }
  return issues;
}

/** 問題データのディレクトリを検証し、問題点をすべて返す。 */
export async function checkQuestionData(
  directory: string,
  expectedCount: number,
): Promise<string[]> {
  const fileNames = (await readdir(directory)).sort();
  const issues = await checkManifest(directory, expectedCount);
  const numbers: number[] = [];

  for (const fileName of fileNames) {
    if (fileName === MANIFEST_FILE) {
      continue;
    }
    const match = QUESTION_FILE.exec(fileName);
    if (match === null) {
      issues.push(`${fileName}: 余分なファイルです`);
      continue;
    }
    const number = Number(match[1]);
    numbers.push(number);
    issues.push(...(await checkQuestionFile(directory, fileName, number)));
  }

  issues.push(...validateQuestionSet(numbers, expectedCount));
  return issues;
}
