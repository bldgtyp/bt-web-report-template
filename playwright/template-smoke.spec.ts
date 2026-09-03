import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { parse as parseYaml } from "yaml";

import { parseCsv } from "../src/data/csv";

// The footer prints `report_date` from project.yaml verbatim, so read it from
// there rather than pinning a literal that goes stale the next time the
// fixture project is re-dated. Null when the key is absent, in which case the
// layout falls back to the manifest's generated_at.
function projectReportDate(): string | null {
  const projectPath = resolve(process.cwd(), "project.yaml");
  if (!existsSync(projectPath)) {
    return null;
  }
  const project = parseYaml(readFileSync(projectPath, "utf8")) as { report_date?: string };
  return project.report_date ?? null;
}

// The schedule must render every scraped room under its own ventilation
// unit's total, so the expectation is the scrape itself rather than labels
// copied into the test. Returns the row headings the table should carry, in
// order, or null when the runtime has no scraped data (the template repo's
// own `data/` is pending until `pnpm smoke:fixture` drops a scrape in).
function scrapedScheduleRowHeadings(): string[] | null {
  const csvPath = resolve(process.cwd(), "data", "room-airflows.csv");
  if (!existsSync(csvPath)) {
    return null;
  }
  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  const unitOf = (row: (typeof rows)[number]) => String(row.allocation_to_vent_unit ?? "");
  const roomRows = rows.filter((row) => row.row_type === "room");
  if (roomRows.length === 0) {
    return null;
  }
  const totalRows = rows.filter((row) => row.row_type === "total");
  const units = [...new Set([...totalRows.map(unitOf), ...roomRows.map(unitOf)])];
  const multiUnit = units.length > 1;

  return units.flatMap((unit) => [
    ...roomRows.filter((row) => unitOf(row) === unit).map((row) => String(row.room_name)),
    multiUnit ? (unit ? `Total (Unit ${unit})` : "Total (Unallocated)") : "Total",
  ]);
}

const reportPages: { path: string; navLabel: string; heading: string | null }[] = [
  // The summary page renders its section with show_heading and
  // show_standalone_heading both false (src/pages/index.astro), so its only
  // heading is the layout's project-titled H1, which varies per project.
  { path: "/", navLabel: "Summary", heading: null },
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
    const reportDate = projectReportDate();
    if (reportDate) {
      await expect(page.locator(".btwr-report-footer time")).toHaveAttribute("datetime", reportDate);
    }
    await expect(page.locator(".btwr-report-footer")).toContainText("Report date");
    if (reportPage.heading) {
      await expect(page.getByRole("heading", { name: reportPage.heading })).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
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
      await expect(page.locator(".btwr-hero__report-date")).toContainText("Report date");
      if (reportDate) {
        await expect(page.locator(".btwr-hero__report-date time")).toHaveAttribute("datetime", reportDate);
      }
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
  // Without scraped data the schedule renders a pending state rather than a
  // table, and there is no table for the cards to sit after.
  test.skip(scrapedScheduleRowHeadings() === null, "no scraped room-airflow data in data/");

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

test("room airflow schedule groups every scraped room under its unit total", async ({ page }) => {
  const expectedHeadings = scrapedScheduleRowHeadings();
  test.skip(expectedHeadings === null, "no scraped room-airflow data in data/");

  await page.goto("/mechanical/");

  const rowHeadings = page.locator('[data-table="room-airflows"] tbody tr > th');
  await expect(rowHeadings).toHaveText(expectedHeadings!);
});

test("print route paginates the room airflow schedule without dropping rows", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Paged.js lays out to the page box, not the viewport");
  const expectedHeadings = scrapedScheduleRowHeadings();
  test.skip(expectedHeadings === null, "no scraped room-airflow data in data/");
  // Paged.js lays out the whole report before anything is assertable.
  test.setTimeout(240_000);

  await page.goto("/print/");
  await page.waitForFunction(
    () => document.documentElement.getAttribute("data-paged-rendered") === "true",
    null,
    { timeout: 180_000 },
  );

  const schedule = await page.evaluate(() => {
    const fragments = [...document.querySelectorAll<HTMLTableElement>('table[data-table="room-airflows"]')];
    return {
      rowHeadings: fragments.flatMap((fragment) =>
        [...fragment.querySelectorAll("tbody tr > th")].map((cell) => cell.textContent?.trim() ?? ""),
      ),
      fragmentsWithoutHeader: fragments.filter((fragment) => !fragment.querySelector("thead")).length,
      fragmentsOutsideTheirPage: fragments.filter((fragment) => {
        const pageBox = fragment.closest(".pagedjs_page_content")?.getBoundingClientRect();
        if (!pageBox) {
          return true;
        }
        const rect = fragment.getBoundingClientRect();
        return rect.bottom - pageBox.bottom > 1 || pageBox.top - rect.top > 1;
      }).length,
    };
  });

  expect(schedule.rowHeadings).toEqual(expectedHeadings!);
  // A continuation page without column headers, or a fragment spilling past
  // its page box, is how the schedule silently loses rows in the PDF.
  expect(schedule.fragmentsWithoutHeader).toBe(0);
  expect(schedule.fragmentsOutsideTheirPage).toBe(0);
});

test("envelope masonry primer download keeps its PDF filename", async ({ page }) => {
  await page.goto("/building_envelope/");

  const primerLink = page.getByRole("link", { name: /Download the Masonry Rowhouse Air-Sealing Primer/ });

  await expect(primerLink).toHaveAttribute("href", "/assets/envelope/masonry-rowhouse-airsealing-primer.pdf");
  await expect(primerLink).toHaveAttribute("download", "masonry-rowhouse-airsealing-primer.pdf");
});

test("stacked-bar axis thins tick labels when the axis track is narrow", async ({ page }) => {
  // Thinning is a container query on the axis itself: every other tick is
  // hidden at 34rem and under. 800px of viewport puts the track near 27rem,
  // clear of that boundary. A wider viewport is not necessarily a wider
  // track — at 1100px the report grid has already dropped to one column and
  // handed the chart *more* width than it has at 1200px.
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto("/energy_model/");

  const hasPendingData = (await page.getByText("Site energy chart pending").count()) > 0;
  if (hasPendingData) {
    test.skip(true, "Fixture data is pending, so no chart axis is rendered.");
  }

  const axisTrackRem = await page
    .locator('[data-chart="site-energy"] .btwr-site-energy-bars__axis')
    .first()
    .evaluate((axis) => axis.getBoundingClientRect().width / Number.parseFloat(getComputedStyle(document.documentElement).fontSize));

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

  // Asserted so that a layout change which widens the track past 34rem fails
  // here, naming the cause, rather than as an unexplained tick-list diff.
  expect(axisTrackRem).toBeLessThanOrEqual(34);
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
