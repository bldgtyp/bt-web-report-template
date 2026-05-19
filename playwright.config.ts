import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.BTWR_PLAYWRIGHT_PORT ?? "4321");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./playwright",
  webServer: {
    command: `pnpm exec astro dev --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
