import { expect, test } from "@playwright/test";

const reportPages = [
  { path: "/", navLabel: "Summary", heading: "Executive summary" },
  { path: "/energy_model/", navLabel: "Energy Model", heading: "Model Geometry" },
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

    await expect(page.locator(".btwr-brand-lockup strong")).toHaveText("BLDGTYP");
    await expect(page.locator(".btwr-masthead__nav a[aria-current='page']")).toHaveText(reportPage.navLabel);
    await expect(page.getByRole("heading", { name: reportPage.heading })).toBeVisible();
    await expect(page.locator(".btwr-report-grid")).toHaveCSS("display", "grid");

    if (reportPage.path === "/") {
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.locator(".btwr-hero")).toHaveCSS("display", "grid");
    } else {
      await expect(page.locator(".btwr-toc")).toBeVisible();
    }

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
    await expect(page.locator('[data-chart="site-energy"] [role="img"]')).toBeVisible();
    await expect(page.locator('[data-chart="site-energy"] .btwr-site-energy-bars__axis span')).toHaveText([
      "0",
      "5,000",
      "10,000",
      "15,000",
      "20,000",
      "25,000",
    ]);
    await expect(page.locator('[data-chart="site-energy"] .btwr-site-energy-bars__axis-label')).toHaveText("kWh / year");
    await expect(page.getByRole("heading", { name: "Annual CO2e emissions due to operational energy consumption" })).toBeVisible();
    await expect(page.locator('[data-chart="co2e"] [role="img"]')).toBeVisible();
    await expect(page.locator('[data-chart="co2e"] .btwr-site-energy-bars__axis span')).toHaveText(["0", "2", "4", "6", "8"]);
    await expect(page.locator('[data-chart="co2e"] .btwr-site-energy-bars__axis-label')).toHaveText("tons CO2e / year");
    await expect(page.locator('[data-chart="co2e"] .btwr-chart-legend__limit')).toBeVisible();
    await expect(page.locator('[data-table="energy-summary"]').first()).toBeVisible();
  }
});

test("template-owned charts also receive expand controls", async ({ page }) => {
  await page.goto("/energy_model/");

  const hasPendingData = (await page.getByText("Site energy chart pending").count()) > 0;
  if (hasPendingData) {
    test.skip(true, "Fixture data is pending, so no chart frames are rendered.");
  }

  const co2Frame = page.locator('[data-chart="co2e"]').first();
  await expect(co2Frame.getByRole("button", { name: "Expand chart" })).toHaveCount(1);

  await co2Frame.hover();
  await co2Frame.getByRole("button", { name: "Expand chart" }).click();
  await expect(page.locator('.btwr-chart-modal[open] [data-chart-expanded="true"][data-chart="co2e"]')).toBeVisible();
});
