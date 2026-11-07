import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CRITERIA } from "./criteria.ts";
import { loadReviewEntries } from "./load-review-entries.ts";
import { findNameFragments, renderNameFragmentsCsv } from "./name-fragments.ts";
import { PRIORITY_NOTES } from "./priority-notes.ts";
import { renderReviewSheet } from "./render-sheet.ts";

const fromRoot = (path: string) =>
  fileURLToPath(new URL(`../../${path}`, import.meta.url));

const OUTPUT = fromRoot(".review/hint-review.html");
const NAME_FRAGMENTS_OUTPUT = fromRoot(".review/name-fragments.csv");

const entries = await loadReviewEntries(
  fromRoot("data/question-sources"),
  PRIORITY_NOTES,
);
const client = await readFile(
  new URL("./sheet-client.js", import.meta.url),
  "utf8",
);
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(
  OUTPUT,
  renderReviewSheet({ entries, criteria: CRITERIA }, client),
);
const fragments = findNameFragments(entries);
await writeFile(NAME_FRAGMENTS_OUTPUT, renderNameFragmentsCsv(fragments));
console.log(`${entries.length} 種の評価シートを出力しました: ${OUTPUT}`);
console.log(
  `名前の一部が出ているヒント ${fragments.length} 件を出力しました: ${NAME_FRAGMENTS_OUTPUT}`,
);
