import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  heatIndexMetrics,
  loadResilienceSeries,
  WINTER_SET_THRESHOLD_C,
  winterSetMetrics,
} from "../src/data/resilience";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(options: {
  summerValues?: number[];
  winterValues?: number[];
  manifest?: Record<string, unknown>;
  summerCsv?: string;
  winterCsv?: string;
} = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "btwr-resilience-"));
  roots.push(root);
  const directory = path.join(root, "public", "downloads", "resilience");
  await mkdir(directory, { recursive: true });
  const manifest =
    options.manifest ??
    manifestFixture({
      summer: [{ id: "SUMMER", label: "Living", order: 1 }],
      winter: [{ id: "WINTER", label: "Bedroom", order: 1 }],
    });
  await writeFile(path.join(directory, "resilience.json"), JSON.stringify(manifest));
  await writeFile(
    path.join(directory, "summer-heat-index.csv"),
    options.summerCsv ?? csvFixture("2016-07-12T00:00:00Z", "SUMMER", options.summerValues ?? values(240, 30)),
  );
  await writeFile(
    path.join(directory, "winter-set.csv"),
    options.winterCsv ??
      csvFixture("2016-01-26T00:00:00Z", "WINTER", options.winterValues ?? values(240, WINTER_SET_THRESHOLD_C)),
  );
  return root;
}

function manifestFixture(zones: { summer: unknown[]; winter: unknown[] }) {
  return {
    schema_version: "1.0.0",
    protocol: "Phius REVIVE 2024 v24.1.1",
    timezone: "UTC",
    generated_at: "2026-07-20T22:00:00Z",
    series: {
      summer: {
        filename: "summer-heat-index.csv",
        source: "summer eplusout.sql",
        generator: "honeybee-REVIVE 0.1.16 / EnergyPlus 25.1",
        outage_start: "2016-07-13T00:00:00Z",
        outage_hours: 168,
        zones: zones.summer,
      },
      winter: {
        filename: "winter-set.csv",
        source: "winter eplusout.sql",
        generator: "honeybee-REVIVE 0.1.16 / EnergyPlus 25.1",
        outage_start: "2016-01-27T00:00:00Z",
        outage_hours: 168,
        zones: zones.winter,
      },
    },
  };
}

function csvFixture(start: string, zone: string, data: number[]): string {
  const startMillis = Date.parse(start);
  return [
    `Date,${zone}`,
    ...data.map((value, index) => `${new Date(startMillis + index * 3_600_000).toISOString()},${value}`),
  ].join("\n");
}

function values(count: number, value: number): number[] {
  return Array.from({ length: count }, () => value);
}

describe("Resilience inputs", () => {
  it("loads different summer and winter zone sets and locates the declared outage", async () => {
    const root = await fixture();
    const summer = await loadResilienceSeries("summer", root);
    const winter = await loadResilienceSeries("winter", root);

    expect(summer.zones.map(({ id }) => id)).toEqual(["SUMMER"]);
    expect(winter.zones.map(({ id }) => id)).toEqual(["WINTER"]);
    expect(summer.timestamps).toHaveLength(240);
    expect(summer.outageStartIndex).toBe(24);
    expect(summer.outageEndIndex).toBe(192);
  });

  it("evaluates only the declared 168-hour summer outage", async () => {
    const data = values(240, 30);
    data[0] = 60;
    data[24] = 40;
    data[25] = 52;
    const metric = heatIndexMetrics(await loadResilienceSeries("summer", await fixture({ summerValues: data })))[
      "SUMMER"
    ];

    expect(metric).toMatchObject({ dangerHours: 1, extremeDangerHours: 1, passesHeatIndexCriterion: false });
  });

  it("evaluates the SET limit inclusively over only the declared outage", async () => {
    const data = values(240, WINTER_SET_THRESHOLD_C);
    data[0] = 0;
    data[24] = WINTER_SET_THRESHOLD_C - 120;
    const metric = winterSetMetrics(await loadResilienceSeries("winter", await fixture({ winterValues: data })))[
      "WINTER"
    ];

    expect(metric.degreeHoursKH).toBeCloseTo(120);
    expect(metric.degreeHoursFH).toBeCloseTo(216);
    expect(metric.passesSetCriterion).toBe(true);
  });

  it("fails a missing sidecar with its path", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "btwr-resilience-"));
    roots.push(root);
    await expect(loadResilienceSeries("summer", root)).rejects.toThrow(/Missing Resilience input:.*resilience\.json/);
  });

  it("fails malformed sidecar JSON", async () => {
    const root = await fixture();
    await writeFile(path.join(root, "public/downloads/resilience/resilience.json"), "{");
    await expect(loadResilienceSeries("summer", root)).rejects.toThrow(/invalid JSON/);
  });

  it("rejects a protocol other than the renderer's supported version", async () => {
    const manifest = manifestFixture({
      summer: [{ id: "SUMMER", label: "Living", order: 1 }],
      winter: [{ id: "WINTER", label: "Bedroom", order: 1 }],
    });
    manifest.protocol = "Phius REVIVE 2021";
    await expect(loadResilienceSeries("summer", await fixture({ manifest }))).rejects.toThrow(
      /protocol must be "Phius REVIVE 2024 v24\.1\.1"/,
    );
  });

  it("fails a missing, extra, or duplicate zone column", async () => {
    await expect(loadResilienceSeries("summer", await fixture({ summerCsv: "Date,OTHER\n2016-07-13T00:00:00Z,1" }))).rejects.toThrow(
      /missing: SUMMER; extra: OTHER/,
    );
    await expect(
      loadResilienceSeries(
        "summer",
        await fixture({ summerCsv: "Date,SUMMER,SUMMER\n2016-07-13T00:00:00Z,1,2" }),
      ),
    ).rejects.toThrow(/Duplicate .* column "SUMMER"/);
  });

  it("fails a short series", async () => {
    const root = await fixture({ summerValues: values(167, 30) });
    await expect(loadResilienceSeries("summer", root)).rejects.toThrow(/at least 168 hourly rows; received 167/);
  });

  it("fails duplicate, non-hourly, and non-UTC timestamps", async () => {
    const validRows = csvFixture("2016-07-12T00:00:00Z", "SUMMER", values(240, 30)).split("\n");
    validRows[3] = validRows[2];
    await expect(loadResilienceSeries("summer", await fixture({ summerCsv: validRows.join("\n") }))).rejects.toThrow(
      /exactly one hour apart/,
    );
    validRows[3] = "2016-07-12T02:30:00Z,30";
    await expect(loadResilienceSeries("summer", await fixture({ summerCsv: validRows.join("\n") }))).rejects.toThrow(
      /exactly one hour apart/,
    );
    validRows[3] = "2016-07-12T02:00:00-04:00,30";
    await expect(loadResilienceSeries("summer", await fixture({ summerCsv: validRows.join("\n") }))).rejects.toThrow(
      /explicit UTC offset/,
    );
  });

  it("fails blank and non-finite values with row and zone", async () => {
    const rows = csvFixture("2016-07-12T00:00:00Z", "SUMMER", values(240, 30)).split("\n");
    rows[2] = "2016-07-12T01:00:00Z,";
    await expect(loadResilienceSeries("summer", await fixture({ summerCsv: rows.join("\n") }))).rejects.toThrow(
      /:3:SUMMER: expected a finite numeric value/,
    );
    rows[2] = "2016-07-12T01:00:00Z,Infinity";
    await expect(loadResilienceSeries("summer", await fixture({ summerCsv: rows.join("\n") }))).rejects.toThrow(
      /:3:SUMMER: expected a finite numeric value/,
    );
  });

  it("fails when the declared outage is absent or incomplete", async () => {
    const root = await fixture();
    const manifest = manifestFixture({
      summer: [{ id: "SUMMER", label: "Living", order: 1 }],
      winter: [{ id: "WINTER", label: "Bedroom", order: 1 }],
    });
    manifest.series.summer.outage_start = "2016-08-01T00:00:00Z";
    await writeFile(path.join(root, "public/downloads/resilience/resilience.json"), JSON.stringify(manifest));
    await expect(loadResilienceSeries("summer", root)).rejects.toThrow(/outage start .* is not present/);

    manifest.series.summer.outage_start = "2016-07-20T00:00:00Z";
    await writeFile(path.join(root, "public/downloads/resilience/resilience.json"), JSON.stringify(manifest));
    await expect(loadResilienceSeries("summer", root)).rejects.toThrow(/168-hour outage .* exceeds/);
  });
});
