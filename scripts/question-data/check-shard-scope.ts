import { fileURLToPath } from "node:url";
import {
  collectChangedPaths,
  findOutOfScopePaths,
  loadShardScope,
} from "./shard-scope.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const [generation = "", base = "origin/main"] = process.argv.slice(2);

const scope = await loadShardScope(root, generation);
const outOfScope = findOutOfScopePaths(collectChangedPaths(root, base), scope);

if (outOfScope.length > 0) {
  console.error(`第 ${scope.generation} 世代の担当外の変更があります:`);
  for (const path of outOfScope) {
    console.error(`  ${path}`);
  }
  process.exit(1);
}
console.log(
  `第 ${scope.generation} 世代(No.${scope.first}〜${scope.last})の範囲内です`,
);
