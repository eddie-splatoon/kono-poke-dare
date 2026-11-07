import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { CRITERIA } from "../scripts/hint-review/criteria.ts";
import { renderReviewSheet } from "../scripts/hint-review/render-sheet.ts";
import { hintsVersion } from "../scripts/hint-review/sheet-client.js";

const IDS = CRITERIA.map(({ id }) => id);
const SPECIES_COUNT = 45;

/** 架空の問題データで作る。実データの中身に影響されないようにする。 */
function fakeEntries(changedNumber?: number) {
  return Array.from({ length: SPECIES_COUNT }, (_, i) => {
    const number = i + 1;
    const hints = Array.from(
      { length: 10 },
      (_, h) => `架空${number}のヒント${h + 1}`,
    );
    if (number === changedNumber) {
      hints[5] = "直した外見の文";
    }
    return {
      number,
      name: `カセツモン${number}`,
      aliases: [],
      generation: number <= 25 ? 1 : 2,
      hints,
      version: hintsVersion(hints),
      ...(number === 2 ? { note: "角の本数に疑い" } : {}),
    };
  });
}

async function writeSheet(path: string, changedNumber?: number) {
  const client = await readFile(
    join("scripts", "hint-review", "sheet-client.js"),
    "utf8",
  );
  await writeFile(
    path,
    renderReviewSheet(
      { entries: fakeEntries(changedNumber), criteria: CRITERIA },
      client,
    ),
  );
}

let directory: string;
let sheetPath: string;

test.beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "hint-review-"));
  sheetPath = join(directory, "sheet.html");
  await writeSheet(sheetPath);
});

test.afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function open(page: Page) {
  await page.goto(pathToFileURL(sheetPath).href);
  await expect(page.getByTestId("card-1")).toBeVisible();
}

function radio(page: Page, number: number, id: string, value: string) {
  return page
    .getByTestId(`card-${number}`)
    .locator(`input[name="${number}-${id}"][value="${value}"]`);
}

async function scoreAll(page: Page, number: number, value: string) {
  for (const id of IDS) {
    await radio(page, number, id, value).check();
  }
}

async function downloadCsv(page: Page): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "CSV を書き出す" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^hint-review-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const path = await download.path();
  return readFile(path, "utf8");
}

test("R-37: 採点して書き出した CSV を file:// のページからダウンロードできる", async ({
  page,
}) => {
  await open(page);
  await scoreAll(page, 1, "4");
  await radio(page, 1, "wording", "NA").check();
  await page.getByTestId("card-1").getByRole("textbox").fill("外見に疑い");

  const csv = await downloadCsv(page);
  const [header, row, ...rest] = csv.replace(/^﻿/, "").trim().split("\r\n");
  expect(rest).toEqual([]);
  expect(header.startsWith("number,name,generation,")).toBe(true);
  expect(row).toContain(",4,4,4,4,NA,4,4,24,4,0,外見に疑い,");
});

test("R-38: 再読み込みしても採点が残る", async ({ page }) => {
  await open(page);
  await radio(page, 1, "accuracy", "3").check();
  await page.getByTestId("card-1").getByRole("textbox").fill("メモ");
  await page.reload();
  await expect(radio(page, 1, "accuracy", "3")).toBeChecked();
  await expect(page.getByTestId("card-1").getByRole("textbox")).toHaveValue(
    "メモ",
  );
});

test("R-39: CSV を取り込むと採点が復元され、件数を表示する", async ({
  page,
}) => {
  await open(page);
  await scoreAll(page, 1, "5");
  const csvPath = join(directory, "scores.csv");
  await writeFile(csvPath, await downloadCsv(page));

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(radio(page, 1, "accuracy", "5")).not.toBeChecked();

  await page.getByLabel("CSV を取り込む").setInputFiles(csvPath);
  await expect(page.getByRole("status")).toContainText("1 件を取り込みました");
  await expect(radio(page, 1, "accuracy", "5")).toBeChecked();
});

test("R-40: 絞り込みの結果を 1 ページ 20 件で表示し、ページを送れる", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator("[data-testid^=card-]")).toHaveCount(20);
  await page.getByRole("button", { name: "次のページ" }).click();
  await expect(page.getByTestId("card-21")).toBeVisible();
  await expect(page.getByTestId("card-1")).toBeHidden();

  await page.getByLabel("世代").selectOption("2");
  await expect(page.locator("[data-testid^=card-]")).toHaveCount(20);
  await expect(page.getByTestId("card-26")).toBeVisible();

  await page.getByLabel("世代").selectOption("");
  await page.getByLabel("優先のみ").check();
  await expect(page.locator("[data-testid^=card-]")).toHaveCount(1);
  await expect(page.getByTestId("card-2")).toContainText("角の本数に疑い");
});

test("R-41: キーボードで全観点を埋めると次のカードへ移る", async ({ page }) => {
  await open(page);
  await page.keyboard.type("5444444");
  await expect(radio(page, 1, "accuracy", "5")).toBeChecked();
  await expect(radio(page, 1, "name_leak", "4")).toBeChecked();
  await page.keyboard.type("0");
  await expect(radio(page, 2, "accuracy", "NA")).toBeChecked();
});

test("R-42: ヒントが変わった種族は未採点に戻り、その件数を表示する", async ({
  page,
}) => {
  await open(page);
  await radio(page, 1, "accuracy", "4").check();
  await radio(page, 2, "accuracy", "4").check();
  await writeSheet(sheetPath, 1);
  await page.reload();
  await expect(page.getByRole("status")).toContainText("1 種");
  await expect(radio(page, 1, "accuracy", "4")).not.toBeChecked();
  await expect(radio(page, 2, "accuracy", "4")).toBeChecked();
});

test("R-43: 3 以下の評点があってコメントが空なら注意を表示する", async ({
  page,
}) => {
  await open(page);
  const card = page.getByTestId("card-1");
  const warning = card.getByText("どのヒントのどこが問題かを");
  await expect(warning).toBeHidden();
  await radio(page, 1, "accuracy", "4").check();
  await expect(warning).toBeHidden();
  await radio(page, 1, "accuracy", "3").check();
  await expect(warning).toBeVisible();
  await card.getByRole("textbox").fill("色が違う");
  await expect(warning).toBeHidden();
});

test("R-44: キーボードで埋めて 3 以下があれば、コメント欄へ移る", async ({
  page,
}) => {
  await open(page);
  await page.keyboard.type("5535555");
  const comment = page.getByTestId("card-1").getByRole("textbox");
  await expect(comment).toBeFocused();
  await page.keyboard.type("色が違う");
  await expect(comment).toHaveValue("色が違う");
  await page.keyboard.press("Escape");
  await expect(comment).not.toBeFocused();
  await page.keyboard.type("5");
  await expect(radio(page, 2, "accuracy", "5")).toBeChecked();
});

test("R-46: 観点を変える前の保存値を引き継がない", async ({ page }) => {
  await open(page);
  const version = hintsVersion(fakeEntries()[0].hints);
  await page.evaluate((recordVersion) => {
    localStorage.clear();
    localStorage.setItem(
      "kono-poke-dare:hint-review:v1",
      JSON.stringify({
        records: {
          1: { version: recordVersion, scores: { accuracy: 4 }, comment: "" },
        },
      }),
    );
  }, version);
  await page.reload();
  await expect(page.getByTestId("card-1")).toBeVisible();
  await expect(radio(page, 1, "accuracy", "4")).not.toBeChecked();
});

test("R-45: ページから外部へ通信できない", async ({ page }) => {
  await open(page);
  // CORS でも fetch は失敗するので、CSP が遮断したことを確かめる。
  const blockedUri = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        document.addEventListener("securitypolicyviolation", (event) => {
          resolve(event.blockedURI);
        });
        fetch("https://example.com/").catch(() => {});
      }),
  );
  expect(blockedUri).toContain("example.com");
});
