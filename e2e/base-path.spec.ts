import { expect, test } from "@playwright/test";

const BASE_PATH = "/kono-poke-dare/";

test("R-19: basePath の配下で、すべてのリソースを取得して配信データで遊べる", async ({
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

  await page.goto(BASE_PATH);

  const progress = page.getByTestId("hint-progress");
  await expect(progress).toHaveText("ヒント 1 / 10");
  await expect(page.getByTestId("hint-list").getByRole("listitem")).toHaveCount(
    1,
  );

  for (let hintNumber = 2; hintNumber <= 10; hintNumber++) {
    await page.getByRole("button", { name: "次のヒントへ" }).click();
    await expect(progress).toHaveText(`ヒント ${hintNumber} / 10`);
  }
  await page.getByRole("button", { name: "あきらめる" }).click();
  await expect(page.getByTestId("answer")).not.toBeEmpty();

  expect(failed).toEqual([]);
  expect(requested.some((url) => url.includes("/data/questions/"))).toBe(true);
  expect(requested.some((url) => url.includes(".css"))).toBe(true);
  for (const url of requested) {
    expect(url.startsWith(`${baseURL}${BASE_PATH}`)).toBe(true);
  }
});
