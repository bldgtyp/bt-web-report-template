import { expect, test } from "@playwright/test";

test("starter report renders available data state without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator(".btwr-brand-lockup strong")).toHaveText("BLDGTYP");
  await expect(page.getByRole("heading", { name: "Executive summary" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Appendix" })).toBeVisible();
  await expect(page.locator(".btwr-hero")).toHaveCSS("display", "grid");
  await expect(page.locator(".btwr-report-grid")).toHaveCSS("display", "grid");

  const hasPendingData = (await page.getByText("Site energy chart pending").count()) > 0;
  if (hasPendingData) {
    await expect(page.getByText("Site energy chart pending").first()).toBeVisible();
    await expect(page.getByText("Energy table pending").first()).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Annual site energy" })).toBeVisible();
    await expect(page.locator('[data-chart="site-energy"] svg[viewBox="0 0 880 360"]')).toBeVisible();
    await expect(page.locator('[data-table="energy-summary"]').first()).toBeVisible();
  }

  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
  expect(consoleErrors).toEqual([]);
});
