import { expect, test } from "@playwright/test";

test("starter report renders pending data state without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Example Passive House Report" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recommended performance path" })).toBeVisible();
  await expect(page.getByText("Site energy chart pending")).toBeVisible();
  await expect(page.getByRole("link", { name: "Appendix" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
  expect(consoleErrors).toEqual([]);
});
