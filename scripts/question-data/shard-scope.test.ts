import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  collectChangedPaths,
  findOutOfScopePaths,
  loadShardScope,
  type ShardScope,
} from "./shard-scope.ts";

const SCOPE: ShardScope = { generation: 2, first: 152, last: 251 };

describe("findOutOfScopePaths", () => {
  it("R-1: 担当の世代の手書きデータの変更は検出しない", () => {
    expect(
      findOutOfScopePaths(
        ["data/question-sources/hand-written/gen-2.json"],
        SCOPE,
      ),
    ).toEqual([]);
  });

  it("R-2: 範囲の両端の配信データの変更は検出しない", () => {
    expect(
      findOutOfScopePaths(
        ["public/data/questions/0152.json", "public/data/questions/0251.json"],
        SCOPE,
      ),
    ).toEqual([]);
  });

  it("R-3: 範囲のすぐ外の配信データの変更を検出する", () => {
    const paths = [
      "public/data/questions/0151.json",
      "public/data/questions/0252.json",
    ];
    expect(findOutOfScopePaths(paths, SCOPE)).toEqual(paths);
  });

  it("R-4: index.json の変更を検出する", () => {
    const paths = ["public/data/questions/index.json"];
    expect(findOutOfScopePaths(paths, SCOPE)).toEqual(paths);
  });

  it("R-5: 他の世代の手書きデータの変更を検出する", () => {
    const paths = [
      "data/question-sources/hand-written/gen-1.json",
      "data/question-sources/hand-written/gen-22.json",
    ];
    expect(findOutOfScopePaths(paths, SCOPE)).toEqual(paths);
  });

  it("R-6: 担当の世代の事実のデータの変更を検出する", () => {
    const paths = ["data/question-sources/facts/gen-2.json"];
    expect(findOutOfScopePaths(paths, SCOPE)).toEqual(paths);
  });

  it("R-7: 仕様とコードの変更を検出する", () => {
    const paths = [
      "docs/specs/quiz-data.md",
      "scripts/check-question-data.test.ts",
      "src/domain/game/validate-question.ts",
    ];
    expect(findOutOfScopePaths(paths, SCOPE)).toEqual(paths);
  });

  it("R-8: 配信データの形に似た別のパスの変更を検出する", () => {
    const paths = [
      "public/data/questions/0200.json.bak",
      "public/data/questions/200.json",
      "x/public/data/questions/0200.json",
    ];
    expect(findOutOfScopePaths(paths, SCOPE)).toEqual(paths);
  });
});

describe("Git と事実のデータの読み取り", () => {
  let directory: string;

  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: directory, encoding: "utf8" });
  const write = (relative: string, content = "{}\n") => {
    const path = join(directory, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "shard-scope-"));
    git("init", "--quiet", "--initial-branch=main");
    git("config", "user.name", "test");
    git("config", "user.email", "test@example.invalid");
    write("public/data/questions/0152.json");
    write("docs/specs/quiz-data.md", "# 仕様\n");
    git("add", ".");
    git("commit", "--quiet", "-m", "base");
    git("switch", "--quiet", "-c", "shard");
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("R-9: 分岐後のコミットの変更を返す", () => {
    write("public/data/questions/0153.json");
    git("add", ".");
    git("commit", "--quiet", "-m", "shard");
    expect(collectChangedPaths(directory, "main")).toEqual([
      "public/data/questions/0153.json",
    ]);
  });

  it("R-10: 比較元だけが進んだ変更は返さない", () => {
    git("switch", "--quiet", "main");
    write("docs/specs/other.md", "# 別\n");
    git("add", ".");
    git("commit", "--quiet", "-m", "main");
    git("switch", "--quiet", "shard");
    expect(collectChangedPaths(directory, "main")).toEqual([]);
  });

  it("R-11: コミットしていない変更と追跡外のファイルを返す", () => {
    write("docs/specs/quiz-data.md", "# 変更\n");
    write("scripts/新しい ファイル.ts", "export {};\n");
    expect(collectChangedPaths(directory, "main")).toEqual([
      "docs/specs/quiz-data.md",
      "scripts/新しい ファイル.ts",
    ]);
  });

  it("R-12: リネームは元と先の両方のパスを返す", () => {
    git("mv", "docs/specs/quiz-data.md", "docs/specs/renamed.md");
    git("commit", "--quiet", "-m", "rename");
    renameSync(
      join(directory, "public/data/questions/0152.json"),
      join(directory, "public/data/questions/0999.json"),
    );
    expect(collectChangedPaths(directory, "main")).toEqual([
      "docs/specs/quiz-data.md",
      "docs/specs/renamed.md",
      "public/data/questions/0152.json",
      "public/data/questions/0999.json",
    ]);
  });

  it("R-13: 事実のデータから世代の番号の範囲を読む", async () => {
    write(
      "data/question-sources/facts/gen-2.json",
      JSON.stringify([{ number: 251 }, { number: 152 }, { number: 200 }]),
    );
    await expect(loadShardScope(directory, "2")).resolves.toEqual({
      generation: 2,
      first: 152,
      last: 251,
    });
  });

  it("R-14: 事実のデータがない世代はエラーにする", async () => {
    await expect(loadShardScope(directory, "2")).rejects.toThrow(
      "第 2 世代の事実のデータを読めません",
    );
  });

  it.each(["0", "1a", "../1", ""])(
    "R-15: 世代の指定が正の整数でなければエラーにする: %j",
    async (generation) => {
      await expect(loadShardScope(directory, generation)).rejects.toThrow(
        "世代は 1 以上の整数で指定してください",
      );
    },
  );

  it("R-16: - で始まる比較元はエラーにする", () => {
    expect(() => collectChangedPaths(directory, "--output=x")).toThrow(
      "比較元が不正です",
    );
  });
});
