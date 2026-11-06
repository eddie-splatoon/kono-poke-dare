import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = resolve(__dirname, "../.github/scripts/check-issue-link.sh");

function check(body: string, author = "eddie-splatoon") {
  return spawnSync("bash", [SCRIPT], {
    env: { ...process.env, PR_AUTHOR: author, PR_BODY: body },
    encoding: "utf8",
  });
}

describe("check-issue-link.sh", () => {
  it.each([
    "Closes #12",
    "closes #12",
    "CLOSES #12",
    "close #12",
    "closed #12",
    "Fix #12",
    "Fixes #12",
    "Fixed #12",
    "Resolve #12",
    "Resolves #12",
    "Resolved #12",
    "Ref #12",
    "Refs #12",
    "Closes: #12",
    "## 関連 Issue\r\n\r\nCloses #12\r\n",
    "対応はCloses #12です",
    "(Refs #12)",
  ])("R-1: 参照を含む本文は成功する: %j", (body) => {
    expect(check(body).status).toBe(0);
  });

  it.each([
    "Closes #",
    "## 関連 Issue\n\nCloses #\n",
    "#12",
    "Closes 12",
    "Closes #0",
    "Closes #12a",
    "Discloses #12",
    "Prefixes #12",
    "See #12",
  ])("R-2: 番号またはキーワードが正しくない本文は失敗する: %j", (body) => {
    const result = check(body);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("::error::");
  });

  it("R-3: 空の本文は失敗する", () => {
    expect(check("").status).toBe(1);
  });

  it.each([
    "<!-- Closes #12 -->",
    "<!--\nCloses #12\n-->",
    "<!-- Closes #12",
    "```\nCloses #12\n```",
    "```text\r\nCloses #12\r\n```\r\n",
    "~~~\nCloses #12\n~~~",
    "```\nCloses #12",
    "`Closes #12`",
  ])("R-4: コメントとコードの中の参照は数えない: %j", (body) => {
    expect(check(body).status).toBe(1);
  });

  it.each([
    "<!-- コメント -->\nCloses #12",
    "```\nコード\n```\nCloses #12",
    "`コード` Closes #12",
  ])("R-4: コメントとコードの外の参照は数える: %j", (body) => {
    expect(check(body).status).toBe(0);
  });

  it.each([
    "Closes https://github.com/eddie-splatoon/kono-poke-dare/issues/12",
    "Closes other/repo#12",
  ])("R-5: URL と他リポジトリの形の参照は数えない: %j", (body) => {
    expect(check(body).status).toBe(1);
  });

  it.each(["", "Bumps foo from 1.0.0 to 1.0.1."])(
    "R-6: Dependabot の PR は本文によらず成功する: %j",
    (body) => {
      expect(check(body, "dependabot[bot]").status).toBe(0);
    },
  );

  it("R-6: Dependabot に似た名前の作成者は対象外にしない", () => {
    expect(check("", "dependabot").status).toBe(1);
  });

  it("シェルのコードを含む本文を実行しない", () => {
    const result = check('$(echo injected) `echo injected` "; echo injected #');
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("injected");
  });
});
