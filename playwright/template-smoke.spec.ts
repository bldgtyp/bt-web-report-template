import { expect, test } from "@playwright/test";

const reportPages = [
  { path: "/", navLabel: "Summary", heading: "Executive summary" },
  { path: "/energy_model/", navLabel: "Energy Model", heading: "Energy model" },
  { path: "/building_envelope/", navLabel: "Envelope", heading: "Model geometry" },
  { path: "/windows/", navLabel: "Windows", heading: "Windows" },
  { path: "/mechanical/", navLabel: "Mechanical", heading: "Mechanical" },
];

for (const reportPage of reportPages) {
  test(`${reportPage.navLabel} page renders without console errors`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto(reportPage.path);

    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator(".btwr-brand-lockup strong")).toHaveText("BLDGTYP");
    await expect(page.locator(".btwr-masthead__nav a[aria-current='page']")).toHaveText(reportPage.navLabel);
    await expect(page.getByRole("heading", { name: reportPage.heading })).toBeVisible();
    await expect(page.locator(".btwr-hero")).toHaveCSS("display", "grid");
    await expect(page.locator(".btwr-report-grid")).toHaveCSS("display", "grid");

    for (const expectedPage of reportPages) {
      await expect(page.locator(".btwr-masthead__nav").getByRole("link", { name: expectedPage.navLabel })).toBeVisible();
    }

    const dimensions = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
    expect(consoleErrors).toEqual([]);
  });
}

test("energy model page renders available PHPP data state", async ({ page }) => {
  await page.goto("/energy_model/");

  const hasPendingData = (await page.getByText("Site energy chart pending").count()) > 0;
  if (hasPendingData) {
    await expect(page.getByText("Site energy chart pending").first()).toBeVisible();
    await expect(page.getByText("Energy table pending").first()).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Annual site energy" })).toBeVisible();
    await expect(page.locator('[data-chart="site-energy"] svg[viewBox="0 0 880 360"]')).toBeVisible();
    await expect(page.locator('[data-table="energy-summary"]').first()).toBeVisible();
  }
});
