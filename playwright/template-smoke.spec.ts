import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const reportPages = [
  { path: "/", navLabel: "Summary", heading: "Executive summary" },
  { path: "/energy_model/", navLabel: "Energy Model", heading: "Model Geometry" },
  { path: "/building_envelope/", navLabel: "Envelope", heading: "Recommended Assemblies" },
  { path: "/windows/", navLabel: "Windows", heading: "Window Thermal Comfort" },
  { path: "/mechanical/", navLabel: "Mechanical", heading: "Fresh-Air Ventilation" },
];

async function stackedBarGeometry(page: Page, chartSelector: string) {
  return page.locator(chartSelector).first().evaluate((frame) => {
    const grid = frame.querySelector(".btwr-site-energy-bars__grid");
    const firstTrack = frame.querySelector(".btwr-site-energy-bars__track");
    const axis = frame.querySelector(".btwr-site-energy-bars__axis");
    const firstSegment = frame.querySelector(".btwr-site-energy-bars__segment");
    if (!grid || !firstTrack || !axis || !firstSegment) {
      return null;
    }
    const gridRect = grid.getBoundingClientRect();
    const firstTrackRect = firstTrack.getBoundingClientRect();
    const axisRect = axis.getBoundingClientRect();
    return {
      axisTop: axisRect.top,
      firstTrackTop: firstTrackRect.top,
      gridBottom: gridRect.bottom,
      gridTop: gridRect.top,
      segmentBoxShadow: getComputedStyle(firstSegment).boxShadow,
      tickAlignmentDeltas: [...axis.querySelectorAll("span")].map((tick) => {
        const tickRect = tick.getBoundingClientRect();
        const tickStyle = getComputedStyle(tick);
        const tickPosition = Number.parseFloat(tickStyle.getPropertyValue("--btwr-tick-position"));
        const expectedLeft = gridRect.left + gridRect.width * (tickPosition / 100);
        const anchorLeft = tick.classList.contains("is-first")
          ? tickRect.left
          : tick.classList.contains("is-last")
            ? tickRect.right
            : tickRect.left + tickRect.width / 2;
        return Math.abs(anchorLeft - expectedLeft);
      }),
    };
  });
}

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
    await expect(page.locator(".btwr-masthead").getByText("Report date")).toHaveCount(0);
    await expect(page.locator(".btwr-report-footer")).toContainText("Report date 2026-05-13");
    await expect(page.getByRole("heading", { name: reportPage.heading })).toBeVisible();
    await expect(page.locator(".btwr-report-grid")).toHaveCSS("display", "grid");

    const dimensions = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    if (dimensions.innerWidth > 1180) {
      await expect(page.locator(".btwr-masthead__nav")).toBeVisible();
      await expect(page.locator(".btwr-masthead__menu")).toBeHidden();
      await expect(page.locator(".btwr-masthead__nav a[aria-current='page']")).toHaveText(reportPage.navLabel);

      for (const expectedPage of reportPages) {
        await expect(page.locator(".btwr-masthead__nav").getByRole("link", { name: expectedPage.navLabel })).toBeVisible();
      }
    } else {
      const mobileMenu = page.locator(".btwr-masthead__menu");

      await expect(page.locator(".btwr-masthead__nav")).toBeHidden();
      await expect(mobileMenu).toBeVisible();
      await expect(mobileMenu.locator(".btwr-masthead__menu-label")).toHaveText(reportPage.navLabel);

      await mobileMenu.locator("summary").click();
      await expect(mobileMenu.locator("a[aria-current='page']")).toHaveText(reportPage.navLabel);

      for (const expectedPage of reportPages) {
        await expect(mobileMenu.getByRole("link", { name: expectedPage.navLabel })).toBeVisible();
      }
    }

    if (reportPage.path === "/") {
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(page.locator(".btwr-hero")).toHaveCSS("display", "grid");
      await expect(page.locator(".btwr-hero__report-date")).toHaveText("Report date 2026-05-13");
    } else if (dimensions.innerWidth > 1180) {
      await expect(page.locator(".btwr-hero__report-date")).toHaveCount(0);
      await expect(page.locator(".btwr-toc")).toBeVisible();
    } else {
      await expect(page.locator(".btwr-hero__report-date")).toHaveCount(0);
      await expect(page.locator(".btwr-toc")).toBeHidden();
    }

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
    expect(consoleErrors).toEqual([]);
  });
}

test("mobile hamburger menu opens primary report pages and navigates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const mobileMenu = page.locator(".btwr-masthead__menu");

  await expect(page.locator(".btwr-masthead__nav")).toBeHidden();
  await expect(mobileMenu).toBeVisible();
  await mobileMenu.locator("summary").click();

  await expect(mobileMenu.getByRole("link", { name: "Mechanical" })).toBeVisible();
  await mobileMenu.getByRole("link", { name: "Mechanical" }).click();

  await expect(page).toHaveURL(/\/mechanical\/$/);
  await expect(page.getByRole("heading", { name: "Fresh-Air Ventilation" })).toBeVisible();
  await expect(page.locator(".btwr-masthead__menu a[aria-current='page']")).toHaveText("Mechanical");
});

test("page table of contents follows click and scroll position", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/energy_model/");

  const toc = page.locator(".btwr-toc");
  const currentLink = toc.locator("a[aria-current='location']");
  await expect(currentLink).toContainText("Model Geometry");

  await toc.getByRole("link", { name: /CO2 Emissions/ }).click();
  await expect(page).toHaveURL(/#co2-emissions$/);
  await expect(currentLink).toContainText("CO2 Emissions");

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(currentLink).toContainText("Passive House Certifications");
  await expect(toc.locator("li.is-current")).toHaveCount(1);
});

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
    await expect(page.locator('[data-chart="co2e"] .btwr-chart-frame__subtitle')).toHaveText(
      "Operational CO2e by modeled variant, in tons CO2e / year.",
    );
    await expect(page.locator('[data-chart="co2e"] .btwr-chart-frame__header')).not.toContainText(
      "EnerPHit by Component:",
    );
    await expect(page.locator('[data-chart="co2e"] .btwr-site-energy-bars__axis span')).toHaveText(["0", "2", "4", "6", "8"]);
    await expect(page.locator('[data-chart="co2e"] .btwr-site-energy-bars__axis-label')).toHaveText("tons CO2e / year");
    await expect(page.locator('[data-chart="co2e"] .btwr-chart-legend__limit')).toBeVisible();
    await expect(page.locator('[data-table="energy-summary"]').first()).toBeVisible();
  }
});

test("mechanical page renders starter plan cards after airflow table", async ({ page }) => {
  await page.goto("/mechanical/");

  const airflowTable = page.locator('[data-table="room-airflows"]');
  const planGrid = page.locator(".btwr-mechanical-plan-grid");

  await expect(airflowTable).toBeVisible();
  await expect(planGrid).toBeVisible();
  await expect(planGrid.locator(".btwr-mechanical-plan-card h3")).toHaveText([
    "Level 00",
    "Level 01",
    "Level 02",
    "Level 03",
  ]);

  const verticalOrder = await page.evaluate(() => {
    const table = document.querySelector('[data-table="room-airflows"]');
    const grid = document.querySelector(".btwr-mechanical-plan-grid");
    return Boolean(table && grid && table.getBoundingClientRect().bottom < grid.getBoundingClientRect().top);
  });

  expect(verticalOrder).toBe(true);
});

test("envelope masonry primer download keeps its PDF filename", async ({ page }) => {
  await page.goto("/building_envelope/");

  const primerLink = page.getByRole("link", { name: /Download the Masonry Rowhouse Air-Sealing Primer/ });

  await expect(primerLink).toHaveAttribute("href", "/assets/envelope/masonry-rowhouse-airsealing-primer.pdf");
  await expect(primerLink).toHaveAttribute("download", "masonry-rowhouse-airsealing-primer.pdf");
});

test("stacked-bar axis thins tick labels when the axis track is narrow", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/energy_model/");

  const hasPendingData = (await page.getByText("Site energy chart pending").count()) > 0;
  if (hasPendingData) {
    test.skip(true, "Fixture data is pending, so no chart axis is rendered.");
  }

  const tickMetrics = await page.locator('[data-chart="site-energy"] .btwr-site-energy-bars__axis span').evaluateAll((ticks) =>
    ticks.map((tick) => {
      const rect = tick.getBoundingClientRect();
      const style = getComputedStyle(tick);
      return {
        left: rect.left,
        right: rect.right,
        text: tick.textContent?.trim() ?? "",
        visible: style.display !== "none" && style.visibility !== "hidden",
      };
    }),
  );
  const visibleTicks = tickMetrics.filter((tick) => tick.visible);

  expect(visibleTicks.map((tick) => tick.text)).toEqual(["0", "10,000", "20,000"]);
  expect(visibleTicks.length).toBeLessThan(tickMetrics.length);
  for (let index = 1; index < visibleTicks.length; index += 1) {
    expect(visibleTicks[index].left).toBeGreaterThanOrEqual(visibleTicks[index - 1].right);
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

test("CO2 chart follows the shared stacked-bar chart pattern", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto("/energy_model/");

  const hasPendingData = (await page.getByText("CO2 emissions chart pending").count()) > 0;
  if (hasPendingData) {
    test.skip(true, "Fixture data is pending, so the CO2 chart is not rendered.");
  }

  const co2Frame = page.locator('[data-chart="co2e"]').first();
  await expect(co2Frame.getByRole("heading", { name: "Annual CO2e emissions due to operational energy consumption" })).toBeVisible();
  await expect(co2Frame.locator(".btwr-chart-frame__subtitle")).toHaveText(
    "Operational CO2e by modeled variant, in tons CO2e / year.",
  );
  await expect(co2Frame.locator(".btwr-chart-legend li")).toHaveText([
    "Heating",
    "Cooling",
    "DHW",
    "Elec Lights",
    "Elec Equip",
    "Pumps / Fans",
    "CO2e Limit",
  ]);
  await expect(co2Frame.locator(".btwr-site-energy-bars__axis span")).toHaveText(["0", "2", "4", "6", "8"]);
  await expect(co2Frame.locator(".btwr-site-energy-bars__axis-label")).toHaveText("tons CO2e / year");

  const geometry = await stackedBarGeometry(page, '[data-chart="co2e"]');
  expect(geometry).not.toBeNull();
  expect(geometry?.gridTop ?? 0).toBeLessThan(geometry?.firstTrackTop ?? 0);
  expect(geometry?.gridTop ?? 0).toBeGreaterThan((geometry?.firstTrackTop ?? 0) - 16);
  expect(Math.abs((geometry?.gridBottom ?? 0) - (geometry?.axisTop ?? 0))).toBeLessThanOrEqual(2);
  expect(Math.max(...(geometry?.tickAlignmentDeltas ?? [0]))).toBeLessThanOrEqual(2);
  expect(geometry?.segmentBoxShadow ?? "").toContain("inset");
});
