import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");
const BIOME = join(ROOT, "node_modules/.bin/biome");

const FORBIDDEN = {
  domain: [
    "@/application",
    "@/infrastructure",
    "@/composition",
    "@/app",
    "@/components",
    "next",
    "react",
    "react-dom",
  ],
  application: [
    "@/infrastructure",
    "@/composition",
    "@/app",
    "@/components",
    "next",
    "react",
    "react-dom",
  ],
  infrastructure: ["@/composition", "@/app", "@/components"],
  composition: ["@/domain", "@/app", "@/components"],
  components: ["@/domain", "@/infrastructure", "@/composition", "@/app"],
  app: ["@/domain", "@/infrastructure"],
};

const ALLOWED = {
  domain: ["@/domain/x", "./x", "./next", "vitest"],
  application: ["@/domain/x", "@/application/x", "./x"],
  infrastructure: ["@/domain/x", "@/application/x", "@/infrastructure/x"],
  composition: ["@/application/x", "@/infrastructure/x", "@/composition/x"],
  components: ["@/application/x", "@/components/x", "react", "next/link"],
  app: [
    "@/application/x",
    "@/composition/x",
    "@/components/x",
    "next",
    "react",
  ],
};

const cases = (table: Record<string, string[]>) =>
  Object.entries(table).flatMap(([layer, sources]) =>
    sources.map((source) => [layer, source] as const),
  );

let tmp: string;
let fileCount = 0;

function lintImport(layer: string, source: string) {
  fileCount += 1;
  const file = join("src", layer, `fixture-${fileCount}.ts`);
  mkdirSync(dirname(join(tmp, file)), { recursive: true });
  writeFileSync(
    join(tmp, file),
    `import { value } from "${source}";\n\nexport const copy = value;\n`,
  );
  return spawnSync(BIOME, ["lint", "--only=style/noRestrictedImports", file], {
    cwd: tmp,
    encoding: "utf8",
  });
}

describe("biome.json の層の禁止 import", () => {
  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), "import-boundaries-"));
    // 一時ディレクトリは Git の管理外なので、VCS の連携だけを無効にする。
    const config = JSON.parse(readFileSync(join(ROOT, "biome.json"), "utf8"));
    config.vcs = { enabled: false };
    writeFileSync(join(tmp, "biome.json"), JSON.stringify(config));
  });

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it.each(["@/infrastructure", "@/infrastructure/indexed-db"])(
    "R-7: domain から %s を import すると失敗する",
    (source) => {
      expect(lintImport("domain", source).status).toBe(1);
    },
  );

  it.each(["next", "next/link"])(
    "R-8: domain から %s を import すると失敗する",
    (source) => {
      expect(lintImport("domain", source).status).toBe(1);
    },
  );

  it.each(cases(FORBIDDEN))(
    "R-9: %s から %s を import すると失敗する",
    (layer, source) => {
      expect(lintImport(layer, source).status).toBe(1);
      expect(lintImport(layer, `${source}/sub`).status).toBe(1);
    },
  );

  it.each(cases(ALLOWED))(
    "R-9: %s から %s を import できる",
    (layer, source) => {
      const result = lintImport(layer, source);
      expect(result.stdout + result.stderr).not.toContain(
        "noRestrictedImports",
      );
      expect(result.status).toBe(0);
    },
  );

  it.each(Object.keys(FORBIDDEN))(
    "R-10: %s で親方向の相対 import を書くと失敗する",
    (layer) => {
      expect(lintImport(layer, "../x").status).toBe(1);
      expect(lintImport(layer, "../../infrastructure/x").status).toBe(1);
    },
  );
});
