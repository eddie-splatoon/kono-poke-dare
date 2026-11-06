import { expect, type Page, test } from "@playwright/test";

const APP_PATH = "/kono-poke-dare/";
const ABOUT_PATH = "/kono-poke-dare/about/";
const QUESTIONS_URL = "**/kono-poke-dare/data/questions/*.json";
const RIGHTS_FORM_URL =
  "https://github.com/eddie-splatoon/kono-poke-dare/issues/new?template=rights.yml";
const TODAY = new Date("2026-11-05T03:00:00.000Z");
const MAX_HINTS = 10;

/** 架空の問題データを返す。配信データの中身に影響されないようにする。 */
async function serveFakeQuestions(page: Page) {
  await page.route(QUESTIONS_URL, async (route) => {
    const fileName = new URL(route.request().url()).pathname.split("/").at(-1);
    if (fileName === "index.json") {
      await route.fulfill({ json: { count: 5 } });
      return;
    }
    await route.fulfill({
      json: {
        number: Number(fileName?.replace(".json", "")),
        name: "カセツモン",
        aliases: [],
        hints: Array.from({ length: MAX_HINTS }, (_, i) => `架空のヒント${i}`),
      },
    });
  });
}

const aboutLink = (page: Page) =>
  page.getByRole("link", { name: "データの扱いと権利について" });
const aboutHeading = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "データの扱いと権利について" });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
});

test.describe("ゲーム画面からの導線", () => {
  test("R-1: ゲーム画面のフッターのリンクから /about を開ける", async ({
    page,
  }) => {
    await serveFakeQuestions(page);
    await page.goto(APP_PATH);

    await aboutLink(page).click();

    await expect(aboutHeading(page)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${ABOUT_PATH}$`));
  });

  test("R-2: 問題データを取得できない画面でも、フッターのリンクから /about を開ける", async ({
    page,
  }) => {
    await page.route(QUESTIONS_URL, (route) => route.abort());
    await page.goto(APP_PATH);
    await expect(
      page.getByRole("button", { name: "もう一度試す" }),
    ).toBeVisible();

    await aboutLink(page).click();

    await expect(aboutHeading(page)).toBeVisible();
  });

  test("R-14: /about からゲームへ戻るリンクで戻ると、進行が復元される", async ({
    page,
  }) => {
    await serveFakeQuestions(page);
    await page.goto(APP_PATH);
    await page.getByRole("button", { name: "次のヒントへ" }).click();
    const progress = page.getByTestId("hint-progress");
    await expect(progress).toHaveText("ヒント 2 / 10");

    await aboutLink(page).click();
    await expect(aboutHeading(page)).toBeVisible();
    await page.getByRole("link", { name: "ゲームに戻る" }).click();

    await expect(progress).toHaveText("ヒント 2 / 10");
  });
});

test.describe("説明", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ABOUT_PATH);
  });

  test("R-3: 記録を端末内のブラウザにだけ保存することを表示する", async ({
    page,
  }) => {
    await expect(
      page.getByText("記録は、お使いの端末のブラウザの中にだけ保存します。"),
    ).toBeVisible();
  });

  test("R-4: 保存する項目を表示し、回答の文字列を保存しないことを表示する", async ({
    page,
  }) => {
    await expect(
      page.getByText("遊んだ日付、問題の番号、進行状況"),
    ).toBeVisible();
    await expect(
      page.getByText("入力した回答の文字列は保存しません。"),
    ).toBeVisible();
  });

  test("R-5: ログインがなく、記録と回答を外部へ送信しないことを表示する", async ({
    page,
  }) => {
    await expect(page.getByText("ログインはありません。")).toBeVisible();
    await expect(
      page.getByText("記録と回答を外部へ送信しません。"),
    ).toBeVisible();
  });

  test("R-6: 配信元の GitHub がアクセスログを持つ可能性を表示する", async ({
    page,
  }) => {
    await expect(page.getByText("アクセスログ")).toBeVisible();
  });

  test("R-7: ブラウザのサイトデータの削除で消せることと、同じドメイン全体が対象になることを表示する", async ({
    page,
  }) => {
    await expect(page.getByText("サイトデータを削除")).toBeVisible();
    await expect(
      page.getByText("同じドメインの他のプロジェクトのデータ"),
    ).toBeVisible();
  });

  test("R-8: 消すと元に戻らないことを表示する", async ({ page }) => {
    await expect(page.getByText("元に戻せません。")).toBeVisible();
  });

  test("R-9: ブラウザの判断で記録が消える場合があることを表示する", async ({
    page,
  }) => {
    await expect(
      page.getByText("ブラウザの判断で記録が消えることがあります。"),
    ).toBeVisible();
  });

  test("R-10: 非公式のファン作品で、権利者と関係がないことを表示する", async ({
    page,
  }) => {
    await expect(page.getByRole("main")).toContainText("非公式のファン作品");
    await expect(page.getByRole("main")).toContainText(
      "任天堂、株式会社ポケモン、その他の権利者とは関係ありません。",
    );
  });

  test("R-11: 権利者向けの連絡先のリンク先は、権利者向けの Issue フォームである", async ({
    page,
  }) => {
    await expect(
      page.getByRole("link", { name: "権利者の方の連絡フォーム" }),
    ).toHaveAttribute("href", RIGHTS_FORM_URL);
  });
});

test.describe("通信", () => {
  test("R-12, R-13: /about のリクエストはすべて basePath の配下で成功し、問題データを取得しない", async ({
    page,
    baseURL,
  }) => {
    const requested: string[] = [];
    const failed: string[] = [];
    page.on("request", (request) => {
      requested.push(request.url());
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        failed.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on("requestfailed", (request) => {
      failed.push(`failed ${request.url()}`);
    });

    await page.goto(ABOUT_PATH, { waitUntil: "networkidle" });

    await expect(aboutHeading(page)).toBeVisible();
    expect(failed).toEqual([]);
    expect(requested.length).toBeGreaterThan(0);
    for (const url of requested) {
      expect(url.startsWith(`${baseURL}/kono-poke-dare/`)).toBe(true);
    }
    expect(requested.some((url) => url.includes("/data/questions/"))).toBe(
      false,
    );
  });
});

test.describe("スマートフォン", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("R-15: 幅 360px で横スクロールが出ない", async ({ page }) => {
    await page.goto(ABOUT_PATH);
    await expect(aboutHeading(page)).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
