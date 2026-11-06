import { defineConfig, devices } from "@playwright/test";

// 並列の worktree で動かすときは E2E_PORT でポートを分ける。
const port = process.env.E2E_PORT ?? "3100";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node scripts/serve-export.mts",
    url: `${baseURL}/kono-poke-dare/`,
    // 別の worktree のサーバーを誤って使わないようにする。
    reuseExistingServer: false,
  },
});
