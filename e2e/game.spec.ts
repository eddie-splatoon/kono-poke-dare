import { expect, type Page, test } from "@playwright/test";

const APP_PATH = "/kono-poke-dare/";
const QUESTIONS_URL = "**/kono-poke-dare/data/questions/*.json";
const TODAY = new Date("2026-11-05T03:00:00.000Z");
const TOMORROW = new Date("2026-11-06T03:00:00.000Z");
const ANSWER = "カセツモン";
const WRONG = "チガウナマエ";
const MAX_HINTS = 10;

const hintText = (hintNumber: number) =>
  `架空のヒント${String(hintNumber).padStart(2, "0")}である。`;

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
        name: ANSWER,
        aliases: [],
        hints: Array.from({ length: MAX_HINTS }, (_, i) => hintText(i + 1)),
      },
    });
  });
}

const hintProgress = (page: Page) => page.getByTestId("hint-progress");
const hints = (page: Page) =>
  page.getByTestId("hint-list").getByRole("listitem");
const guessInput = (page: Page) => page.getByRole("textbox", { name: "回答" });
const submitButton = (page: Page) =>
  page.getByRole("button", { name: "回答する" });
const skipButton = (page: Page) =>
  page.getByRole("button", { name: "次のヒントへ" });
const giveUpButton = (page: Page) =>
  page.getByRole("button", { name: "あきらめる" });

/** Next.js のルートアナウンサーも role="alert" を持つので、本文で絞り込む。 */
const alertWith = (page: Page, text: string) =>
  page.getByRole("alert").filter({ hasText: text });

async function open(page: Page) {
  await page.goto(APP_PATH);
  await expect(hintProgress(page)).toBeVisible();
}

async function guess(page: Page, text: string) {
  await guessInput(page).fill(text);
  await submitButton(page).click();
}

async function skipTo(page: Page, hintNumber: number) {
  for (let current = 1; current < hintNumber; current++) {
    await skipButton(page).click();
    await expect(hintProgress(page)).toHaveText(
      `ヒント ${current + 1} / ${MAX_HINTS}`,
    );
  }
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await serveFakeQuestions(page);
});

test.describe("表示", () => {
  test("R-1: 開くと、ヒント 1 と「ヒント 1 / 10」を表示する", async ({
    page,
  }) => {
    await open(page);

    await expect(hintProgress(page)).toHaveText("ヒント 1 / 10");
    await expect(hints(page)).toHaveText([hintText(1)]);
  });

  test("R-2, R-3: 未公開のヒントと回答前の正解を DOM に含めない", async ({
    page,
  }) => {
    await open(page);
    await skipTo(page, 3);
    await guess(page, WRONG);
    await expect(hintProgress(page)).toHaveText("ヒント 4 / 10");

    const html = await page.content();
    for (let hintNumber = 5; hintNumber <= MAX_HINTS; hintNumber++) {
      expect(html).not.toContain(hintText(hintNumber));
    }
    expect(html).not.toContain(ANSWER);
  });
});

test.describe("回答", () => {
  test("R-4: 正解すると、結果を表示する", async ({ page }) => {
    await open(page);

    await guess(page, ANSWER);

    await expect(page.getByRole("heading", { name: "正解!" })).toBeVisible();
    await expect(page.getByTestId("score")).toHaveText("100 点");
  });

  test("R-4: ひらがなの回答と Enter でも正解になる", async ({ page }) => {
    await open(page);

    await guessInput(page).fill("かせつもん");
    await guessInput(page).press("Enter");

    await expect(page.getByRole("heading", { name: "正解!" })).toBeVisible();
  });

  test("R-5: 不正解なら、入力欄を空にして、次のヒントと通知を表示する", async ({
    page,
  }) => {
    await open(page);

    await guess(page, WRONG);

    await expect(hintProgress(page)).toHaveText("ヒント 2 / 10");
    await expect(hints(page)).toHaveText([hintText(1), hintText(2)]);
    await expect(page.getByRole("status")).toContainText("不正解");
    await expect(guessInput(page)).toHaveValue("");
    await expect(guessInput(page)).toBeFocused();
  });

  test("R-6: 空の回答では、ヒントを進めずに案内を表示する", async ({
    page,
  }) => {
    await open(page);

    await guess(page, "   ");

    await expect(page.getByRole("status")).toContainText("名前を入力");
    await expect(hintProgress(page)).toHaveText("ヒント 1 / 10");
  });
});

test.describe("次のヒントへ進む", () => {
  test("R-7: 「次のヒントへ」で次のヒントを表示し、得点が下がる", async ({
    page,
  }) => {
    await open(page);

    await skipButton(page).click();

    await expect(hintProgress(page)).toHaveText("ヒント 2 / 10");
    await expect(hints(page)).toHaveText([hintText(1), hintText(2)]);

    await guess(page, ANSWER);
    await expect(page.getByTestId("score")).toHaveText("90 点");
  });

  test("R-8: ヒント 10 では、ボタンの文言を「あきらめる」にする", async ({
    page,
  }) => {
    await open(page);

    await expect(giveUpButton(page)).toHaveCount(0);

    await skipTo(page, MAX_HINTS);

    await expect(giveUpButton(page)).toBeVisible();
    await expect(skipButton(page)).toHaveCount(0);
  });

  test("R-9: 二重クリックしても、ヒントは 1 つだけ進む", async ({ page }) => {
    await open(page);

    await skipButton(page).dblclick();

    await expect(hintProgress(page)).toHaveText("ヒント 2 / 10");
    await expect(skipButton(page)).toBeEnabled();
    await expect(hintProgress(page)).toHaveText("ヒント 2 / 10");
  });

  test("R-10: あきらめると、0 点の結果と正解を表示する", async ({ page }) => {
    await open(page);
    await skipTo(page, MAX_HINTS);

    await giveUpButton(page).click();

    await expect(page.getByRole("heading", { name: "残念!" })).toBeVisible();
    await expect(page.getByTestId("score")).toHaveText("0 点");
    await expect(page.getByTestId("answer")).toHaveText(ANSWER);
  });

  test("R-10: ヒント 10 で不正解でも、0 点の結果を表示する", async ({
    page,
  }) => {
    await open(page);

    for (let hintNumber = 1; hintNumber <= MAX_HINTS; hintNumber++) {
      await expect(hintProgress(page)).toHaveText(
        `ヒント ${hintNumber} / ${MAX_HINTS}`,
      );
      await guess(page, WRONG);
    }

    await expect(page.getByRole("heading", { name: "残念!" })).toBeVisible();
    await expect(page.getByTestId("score")).toHaveText("0 点");
    await expect(hints(page)).toHaveCount(MAX_HINTS);
  });
});

test.describe("結果", () => {
  test("R-11: 得点、正解、累積スコア、見たヒントを表示し、入力欄を表示しない", async ({
    page,
  }) => {
    await open(page);
    await skipTo(page, 3);

    await guess(page, ANSWER);

    await expect(page.getByTestId("score")).toHaveText("80 点");
    await expect(page.getByTestId("answer")).toHaveText(ANSWER);
    await expect(page.getByTestId("total-score")).toHaveText("80 点");
    await expect(hints(page)).toHaveCount(3);
    await expect(guessInput(page)).toHaveCount(0);
    await expect(skipButton(page)).toHaveCount(0);
  });
});

test.describe("再開", () => {
  test("R-12: 再読み込みしても、進行を保つ", async ({ page }) => {
    await open(page);
    await skipTo(page, 3);

    await page.reload();

    await expect(hintProgress(page)).toHaveText("ヒント 3 / 10");
    await expect(hints(page)).toHaveCount(3);
  });

  test("R-13: 遊び終えた日に開くと、結果を表示する", async ({ page }) => {
    await open(page);
    await guess(page, ANSWER);
    await expect(page.getByTestId("score")).toHaveText("100 点");

    await page.reload();

    await expect(page.getByTestId("score")).toHaveText("100 点");
    await expect(page.getByTestId("total-score")).toHaveText("100 点");
    await expect(guessInput(page)).toHaveCount(0);
  });

  test("R-14: 翌日に開くと新しいゲームになり、累積スコアに加算する", async ({
    page,
  }) => {
    await open(page);
    await guess(page, ANSWER);
    await expect(page.getByTestId("total-score")).toHaveText("100 点");

    await page.clock.setFixedTime(TOMORROW);
    await page.reload();

    await expect(hintProgress(page)).toHaveText("ヒント 1 / 10");

    await skipTo(page, 2);
    await guess(page, ANSWER);

    await expect(page.getByTestId("score")).toHaveText("90 点");
    await expect(page.getByTestId("total-score")).toHaveText("190 点");
  });
});

test.describe("エラー", () => {
  test("R-15: 問題データを取得できなければ案内を表示し、再開できる", async ({
    page,
  }) => {
    await page.unroute(QUESTIONS_URL);
    await page.route(QUESTIONS_URL, (route) =>
      route.fulfill({ status: 500, body: "error" }),
    );

    await page.goto(APP_PATH);

    await expect(alertWith(page, "読み込めません")).toBeVisible();
    await expect(hintProgress(page)).toHaveCount(0);

    await page.unroute(QUESTIONS_URL);
    await serveFakeQuestions(page);
    await page.getByRole("button", { name: "もう一度試す" }).click();

    await expect(hintProgress(page)).toHaveText("ヒント 1 / 10");
  });

  test("R-16: 開始時に記録を保存できなければ案内を表示する", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      IDBFactory.prototype.open = () => {
        throw new Error("IndexedDB を使えません");
      };
    });

    await page.goto(APP_PATH);

    await expect(alertWith(page, "記録を保存できません")).toBeVisible();
  });

  test("R-16: 操作中に記録を保存できなければ、ヒントを進めない", async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() => {
      IDBFactory.prototype.open = () => {
        throw new Error("IndexedDB を使えません");
      };
    });

    await skipButton(page).click();

    await expect(alertWith(page, "記録を保存できません")).toBeVisible();
    await expect(hintProgress(page)).toHaveText("ヒント 1 / 10");
    await expect(skipButton(page)).toBeEnabled();
  });
});

test.describe("スマートフォン", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  async function expectNoHorizontalScroll(page: Page) {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  }

  test("R-17: 幅 360px で横スクロールが出ない", async ({ page }) => {
    await open(page);
    await expectNoHorizontalScroll(page);

    await guess(page, ANSWER);
    await expect(page.getByTestId("score")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("R-18: 操作部品の高さは 44px 以上で、入力欄の文字は 16px 以上である", async ({
    page,
  }) => {
    await open(page);

    for (const control of [
      guessInput(page),
      submitButton(page),
      skipButton(page),
    ]) {
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    const fontSize = await guessInput(page).evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });
});
