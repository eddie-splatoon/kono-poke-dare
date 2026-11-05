import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = resolve(__dirname, "worktree.sh");
const ACCOUNT_TOKEN = "token-eddie-splatoon";

const FAKE_GH = `#!/bin/sh
case "$1 $2" in
  "auth token")
    [ "$4" = "eddie-splatoon" ] && echo "${ACCOUNT_TOKEN}"
    ;;
  "api user")
    if [ "$GH_TOKEN" = "${ACCOUNT_TOKEN}" ]; then
      echo eddie-splatoon
    else
      echo someone-else
    fi
    ;;
  "pr list")
    [ -f "$FAKE_DIR/gh-pr-list-fails" ] && exit 1
    touch "$FAKE_DIR/prs"
    awk -v branch="$4" -v state="$6" '$1 == branch && $3 == state { print $2 }' "$FAKE_DIR/prs"
    ;;
  *)
    exit 64
    ;;
esac
`;

const FAKE_PNPM = `#!/bin/sh
[ -f "$FAKE_DIR/pnpm-fails" ] && exit 1
echo "$*" > "$FAKE_DIR/pnpm-args"
mkdir -p node_modules
touch node_modules/installed
`;

let tmp: string;
let fakeDir: string;
let repo: string;
let env: NodeJS.ProcessEnv;

function run(command: string, args: string[], cwd: string) {
  return spawnSync(command, args, { cwd, env, encoding: "utf8" });
}

function git(cwd: string, ...args: string[]): string {
  const result = run("git", args, cwd);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function worktreeScript(cwd: string, ...args: string[]) {
  return run("bash", [SCRIPT, ...args], cwd);
}

function commit(cwd: string, message: string): string {
  git(cwd, "commit", "--allow-empty", "-m", message);
  return git(cwd, "rev-parse", "HEAD");
}

function pathOf(slug: string): string {
  return join(repo, ".claude/worktrees", slug);
}

/** 作業のコミットを 1 つ持つ worktree を作り、その HEAD を返す */
function addWorktree(branch: string): { path: string; head: string } {
  const path = pathOf(branch.replaceAll("/", "-"));
  git(repo, "worktree", "add", "-b", branch, path, "origin/main");
  mkdirSync(join(path, "node_modules"));
  writeFileSync(join(path, "node_modules/installed"), "");
  return { path, head: commit(path, `work on ${branch}`) };
}

function addPr(branch: string, head: string, state = "merged") {
  appendFileSync(join(fakeDir, "prs"), `${branch} ${head} ${state}\n`);
}

function branchExists(branch: string): boolean {
  const refs = git(repo, "branch", "--list", branch);
  return refs !== "";
}

beforeEach(() => {
  tmp = realpathSync(mkdtempSync(join(tmpdir(), "worktree-test-")));
  fakeDir = join(tmp, "fake");
  const binDir = join(tmp, "bin");
  mkdirSync(fakeDir);
  mkdirSync(binDir);
  writeFileSync(join(binDir, "gh"), FAKE_GH);
  writeFileSync(join(binDir, "pnpm"), FAKE_PNPM);
  chmodSync(join(binDir, "gh"), 0o755);
  chmodSync(join(binDir, "pnpm"), 0o755);

  env = {
    NODE_ENV: "test",
    PATH: `${binDir}:${process.env.PATH}`,
    HOME: tmp,
    FAKE_DIR: fakeDir,
    GH_TOKEN: ACCOUNT_TOKEN,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.com",
  };

  const origin = join(tmp, "origin.git");
  repo = join(tmp, "repo");
  git(tmp, "init", "--bare", "--initial-branch=main", origin);
  git(tmp, "clone", origin, repo);
  git(repo, "switch", "--create", "main");
  writeFileSync(join(repo, ".gitignore"), "node_modules\n.claude/worktrees\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "initial");
  git(repo, "push", "origin", "main");
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("worktree.sh", { timeout: 30_000 }, () => {
  describe("new", () => {
    it("R-1: origin/main から分岐した新しいブランチの worktree をスラッグのパスに作る", () => {
      const originMain = git(repo, "rev-parse", "origin/main");
      commit(repo, "ローカルだけのコミット");

      const result = worktreeScript(repo, "new", "feat/some-thing");

      expect(result.stderr).not.toContain("使い方");
      expect(result.status).toBe(0);
      const path = pathOf("feat-some-thing");
      expect(git(path, "rev-parse", "HEAD")).toBe(originMain);
      expect(git(path, "branch", "--show-current")).toBe("feat/some-thing");
    });

    it("R-2: --base で指定した ref から分岐する", () => {
      git(repo, "switch", "-c", "base-branch");
      const base = commit(repo, "base");
      git(repo, "switch", "main");

      const result = worktreeScript(
        repo,
        "new",
        "feat/x",
        "--base",
        "base-branch",
      );

      expect(result.status).toBe(0);
      expect(git(pathOf("feat-x"), "rev-parse", "HEAD")).toBe(base);
    });

    it("R-2: 存在しない ref を --base に渡すと失敗し、何も作らない", () => {
      const result = worktreeScript(repo, "new", "feat/x", "--base", "nope");

      expect(result.status).not.toBe(0);
      expect(existsSync(pathOf("feat-x"))).toBe(false);
      expect(branchExists("feat/x")).toBe(false);
    });

    it("R-3: 依存をインストールし、絶対パスを標準出力の最終行に出す", () => {
      const result = worktreeScript(repo, "new", "feat/x");

      expect(result.status).toBe(0);
      const lines = result.stdout.trim().split("\n");
      expect(lines.at(-1)).toBe(pathOf("feat-x"));
      expect(readFileSync(join(fakeDir, "pnpm-args"), "utf8").trim()).toBe(
        "install --frozen-lockfile",
      );
      expect(existsSync(join(pathOf("feat-x"), "node_modules/installed"))).toBe(
        true,
      );
    });

    it("R-3: インストールに失敗すると 0 以外で終了し、残した worktree の場所を表示する", () => {
      writeFileSync(join(fakeDir, "pnpm-fails"), "");

      const result = worktreeScript(repo, "new", "feat/x");

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(pathOf("feat-x"));
      expect(existsSync(pathOf("feat-x"))).toBe(true);
    });

    it("R-4: 既存のブランチ名では失敗し、何も作らない", () => {
      git(repo, "branch", "feat/exists");

      const result = worktreeScript(repo, "new", "feat/exists");

      expect(result.status).not.toBe(0);
      expect(existsSync(pathOf("feat-exists"))).toBe(false);
    });

    it.each(["bad..name", "-bad", "@{-1}", "with space"])(
      "R-4: 不正なブランチ名 %s では失敗し、何も作らない",
      (name) => {
        const result = worktreeScript(repo, "new", name);

        expect(result.status).not.toBe(0);
        expect(existsSync(join(repo, ".claude/worktrees"))).toBe(false);
      },
    );

    it("R-12: 事前の clean が失敗しても worktree を作る", () => {
      writeFileSync(join(fakeDir, "gh-pr-list-fails"), "");
      addWorktree("feat/other");

      const result = worktreeScript(repo, "new", "feat/x");

      expect(result.status).toBe(0);
      expect(existsSync(pathOf("feat-x"))).toBe(true);
      expect(result.stdout.trim().split("\n").at(-1)).toBe(pathOf("feat-x"));
    });

    it("R-12: 事前の clean がマージ済みの worktree を回収しても、最終行はパスのまま", () => {
      const merged = addWorktree("feat/merged");
      addPr("feat/merged", merged.head);

      const result = worktreeScript(repo, "new", "feat/x");

      expect(result.status).toBe(0);
      expect(existsSync(merged.path)).toBe(false);
      expect(result.stdout.trim().split("\n")).toEqual([pathOf("feat-x")]);
    });
  });

  describe("clean", () => {
    it("R-5: マージ済みで変更のない worktree とローカルブランチを削除する", () => {
      const { path, head } = addWorktree("feat/done");
      addPr("feat/done", head);

      const result = worktreeScript(repo, "clean");

      expect(result.status).toBe(0);
      expect(existsSync(path)).toBe(false);
      expect(branchExists("feat/done")).toBe(false);
    });

    it("R-6: PR がない worktree を残す", () => {
      const { path } = addWorktree("feat/no-pr");

      const result = worktreeScript(repo, "clean");

      expect(result.status).toBe(0);
      expect(existsSync(path)).toBe(true);
      expect(branchExists("feat/no-pr")).toBe(true);
      expect(result.stdout).toContain(path);
    });

    it("R-6: PR が未マージの worktree を残す", () => {
      const { path, head } = addWorktree("feat/open");
      addPr("feat/open", head, "open");

      const result = worktreeScript(repo, "clean");

      expect(result.status).toBe(0);
      expect(existsSync(path)).toBe(true);
    });

    it("R-7: 未コミットの変更がある worktree を残す", () => {
      const { path, head } = addWorktree("feat/dirty");
      addPr("feat/dirty", head);
      writeFileSync(join(path, ".gitignore"), "changed\n");

      const result = worktreeScript(repo, "clean");

      expect(result.status).toBe(0);
      expect(existsSync(path)).toBe(true);
      expect(branchExists("feat/dirty")).toBe(true);
    });

    it("R-7: 追跡外のファイルがある worktree を残す", () => {
      const { path, head } = addWorktree("feat/untracked");
      addPr("feat/untracked", head);
      writeFileSync(join(path, "new-file.txt"), "work\n");

      const result = worktreeScript(repo, "clean");

      expect(result.status).toBe(0);
      expect(existsSync(join(path, "new-file.txt"))).toBe(true);
    });

    it("R-8: HEAD が PR の head と異なる worktree を残す", () => {
      const { path, head } = addWorktree("feat/moved");
      addPr("feat/moved", head);
      commit(path, "マージ後のコミット");

      const result = worktreeScript(repo, "clean");

      expect(result.status).toBe(0);
      expect(existsSync(path)).toBe(true);
      expect(branchExists("feat/moved")).toBe(true);
    });

    it("R-9: 実行中の worktree 自身を残し、ほかのマージ済みは削除する", () => {
      const self = addWorktree("feat/self");
      addPr("feat/self", self.head);
      const other = addWorktree("feat/other");
      addPr("feat/other", other.head);

      const result = worktreeScript(self.path, "clean");

      expect(result.status).toBe(0);
      expect(existsSync(self.path)).toBe(true);
      expect(branchExists("feat/self")).toBe(true);
      expect(existsSync(other.path)).toBe(false);
    });

    it("R-10: 親のチェックアウトを対象にしない", () => {
      git(repo, "switch", "-c", "feat/in-root");
      const head = commit(repo, "root");
      addPr("feat/in-root", head);

      const result = worktreeScript(repo, "clean");

      expect(result.status).toBe(0);
      expect(git(repo, "branch", "--show-current")).toBe("feat/in-root");
    });

    it("R-10: .claude/worktrees/ の外の worktree を対象にしない", () => {
      const outside = join(tmp, "outside");
      git(
        repo,
        "worktree",
        "add",
        "-b",
        "feat/outside",
        outside,
        "origin/main",
      );
      const head = commit(outside, "outside");
      addPr("feat/outside", head);

      const result = worktreeScript(repo, "clean");

      expect(result.status).toBe(0);
      expect(existsSync(outside)).toBe(true);
      expect(branchExists("feat/outside")).toBe(true);
    });

    it("R-11: 操作アカウントが異なると、削除せずに失敗する", () => {
      const { path, head } = addWorktree("feat/done");
      addPr("feat/done", head);
      env.GH_TOKEN = "token-of-someone-else";

      const result = worktreeScript(repo, "clean");

      expect(result.status).not.toBe(0);
      expect(existsSync(path)).toBe(true);
      expect(branchExists("feat/done")).toBe(true);
    });

    it("R-11: gh が失敗すると、削除せずに失敗する", () => {
      const { path, head } = addWorktree("feat/done");
      addPr("feat/done", head);
      writeFileSync(join(fakeDir, "gh-pr-list-fails"), "");

      const result = worktreeScript(repo, "clean");

      expect(result.status).not.toBe(0);
      expect(existsSync(path)).toBe(true);
    });

    it("R-13: GH_TOKEN が未設定なら eddie-splatoon のトークンを使う", () => {
      const { path, head } = addWorktree("feat/done");
      addPr("feat/done", head);
      delete env.GH_TOKEN;

      const result = worktreeScript(repo, "clean");

      expect(result.status).toBe(0);
      expect(existsSync(path)).toBe(false);
    });
  });

  it("引数が不正なときは使い方を出して 2 で終了する", () => {
    for (const args of [[], ["unknown"], ["new"], ["new", "a", "--base"]]) {
      const result = worktreeScript(repo, ...args);

      expect(result.status).toBe(2);
      expect(result.stderr).toContain("使い方");
    }
  });
});
