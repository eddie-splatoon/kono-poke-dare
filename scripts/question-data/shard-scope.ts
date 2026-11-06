import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** ワーカー 1 つが担当する世代と、問題番号の範囲。 */
export type ShardScope = {
  readonly generation: number;
  readonly first: number;
  readonly last: number;
};

const QUESTION_FILE = /^public\/data\/questions\/(\d{4})\.json$/;

function isInScope(path: string, scope: ShardScope): boolean {
  if (
    path === `data/question-sources/hand-written/gen-${scope.generation}.json`
  ) {
    return true;
  }
  const match = QUESTION_FILE.exec(path);
  if (match === null) {
    return false;
  }
  const number = Number(match[1]);
  return number >= scope.first && number <= scope.last;
}

/** 担当の範囲に含まれない変更のパスを返す。 */
export function findOutOfScopePaths(
  paths: readonly string[],
  scope: ShardScope,
): string[] {
  return paths.filter((path) => !isInScope(path, scope));
}

/** 事実のデータから、世代の問題番号の範囲を読む。 */
export async function loadShardScope(
  root: string,
  generationText: string,
): Promise<ShardScope> {
  if (!/^[1-9]\d*$/.test(generationText)) {
    throw new Error("世代は 1 以上の整数で指定してください");
  }
  const generation = Number(generationText);

  let numbers: number[];
  try {
    const facts = JSON.parse(
      await readFile(
        join(root, `data/question-sources/facts/gen-${generation}.json`),
        "utf8",
      ),
    ) as { readonly number: number }[];
    numbers = facts.map(({ number }) => number);
  } catch (cause) {
    throw new Error(`第 ${generation} 世代の事実のデータを読めません`, {
      cause,
    });
  }
  if (numbers.length === 0) {
    throw new Error(`第 ${generation} 世代の事実のデータを読めません`);
  }
  return {
    generation,
    first: Math.min(...numbers),
    last: Math.max(...numbers),
  };
}

/** NUL 区切りの出力を分割する。パスの空白や日本語を、そのまま扱うため。 */
function splitNul(output: string): string[] {
  return output.split("\0").filter((entry) => entry !== "");
}

/**
 * 分岐後のコミット、コミットしていない変更、追跡外のファイルのパスを返す。
 * リネームは元と先の両方を検査できるように、削除と追加に分けて扱う。
 */
export function collectChangedPaths(root: string, base: string): string[] {
  if (base.startsWith("-")) {
    throw new Error(`比較元が不正です: ${base}`);
  }
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" });

  const committed = splitNul(
    git("diff", "--name-only", "--no-renames", "-z", `${base}...HEAD`, "--"),
  );
  // 各項目は "XY パス" の形で、先頭の 3 文字が状態を表す。
  const uncommitted = splitNul(
    git("status", "--porcelain", "-z", "--no-renames", "--untracked-files=all"),
  ).map((entry) => entry.slice(3));

  return [...new Set([...committed, ...uncommitted])].sort();
}
