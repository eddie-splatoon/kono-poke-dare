import { normalizeAnswer } from "@/domain/answer/normalize-answer";
import { MAX_HINTS } from "@/domain/scoring/score";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1;
}

function validateHints(hints: unknown, acceptedNames: readonly string[]) {
  if (!isStringArray(hints)) {
    return ["hints が文字列の配列ではありません"];
  }
  const issues: string[] = [];
  if (hints.length !== MAX_HINTS) {
    issues.push(`ヒントが ${MAX_HINTS} 個ではありません: ${hints.length} 個`);
  }
  const seen = new Set<string>();
  hints.forEach((hint, index) => {
    const label = `ヒント ${index + 1}`;
    const normalized = normalizeAnswer(hint);
    if (normalized === "") {
      issues.push(`${label} が空です`);
      return;
    }
    if (seen.has(normalized)) {
      issues.push(`${label} が重複しています`);
    }
    seen.add(normalized);
    if (acceptedNames.some((name) => normalized.includes(name))) {
      issues.push(`${label} に正解の名前が含まれています`);
    }
  });
  return issues;
}

/** 問題データとして読み込む前の値を検証し、問題点をすべて返す。 */
export function validateQuestion(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["問題がオブジェクトではありません"];
  }

  const issues: string[] = [];
  const { number, name, aliases, hints } = value;
  if (!isPositiveInteger(number)) {
    issues.push("number が 1 以上の整数ではありません");
  }

  const acceptedNames = new Set<string>();
  if (typeof name !== "string") {
    issues.push("name が文字列ではありません");
  } else if (normalizeAnswer(name) === "") {
    issues.push("name が空です");
  } else {
    acceptedNames.add(normalizeAnswer(name));
  }

  if (!isStringArray(aliases)) {
    issues.push("aliases が文字列の配列ではありません");
  } else {
    for (const alias of aliases) {
      const normalized = normalizeAnswer(alias);
      if (normalized === "") {
        issues.push("別名が空です");
      } else if (acceptedNames.has(normalized)) {
        issues.push(`別名が重複しています: ${alias}`);
      } else {
        acceptedNames.add(normalized);
      }
    }
  }

  issues.push(...validateHints(hints, [...acceptedNames]));

  const label = isPositiveInteger(number) ? `問題 ${number}` : "問題(番号不明)";
  return issues.map((issue) => `${label}: ${issue}`);
}

/** 問題番号の一覧が 1〜expectedCount で過不足なく揃っているかを検証する。 */
export function validateQuestionSet(
  numbers: readonly number[],
  expectedCount: number,
): string[] {
  const issues: string[] = [];
  const present = new Set(numbers);
  for (let number = 1; number <= expectedCount; number++) {
    if (!present.has(number)) {
      issues.push(`問題 ${number} がありません`);
    }
  }
  const seen = new Set<number>();
  for (const number of numbers) {
    if (seen.has(number)) {
      issues.push(`問題 ${number} が重複しています`);
    } else if (
      !Number.isInteger(number) ||
      number < 1 ||
      number > expectedCount
    ) {
      issues.push(`問題 ${number} は 1〜${expectedCount} の範囲外です`);
    }
    seen.add(number);
  }
  return issues;
}

/** index.json の値を検証し、問題点をすべて返す。 */
export function validateQuestionManifest(value: unknown): string[] {
  if (!isRecord(value) || !isPositiveInteger(value.count)) {
    return ["count が 1 以上の整数ではありません"];
  }
  return [];
}
