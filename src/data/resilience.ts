import { csvParse } from "d3-dsv";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type ResilienceKind = "summer" | "winter";

export interface ResilienceZoneConfig {
  id: string;
  label: string;
  order: number;
}

export interface ResilienceSeriesConfig {
  filename: string;
  source: string;
  generator: string;
  outage_start: string;
  outage_hours: 168;
  zones: ResilienceZoneConfig[];
}

export interface ResilienceManifest {
  schema_version: "1.0.0";
  protocol: string;
  timezone: "UTC";
  generated_at: string;
  series: Record<ResilienceKind, ResilienceSeriesConfig>;
}

export interface ResilienceZoneSeries extends ResilienceZoneConfig {
  values: number[];
}

export interface ResilienceSeries {
  kind: ResilienceKind;
  manifest: ResilienceManifest;
  config: ResilienceSeriesConfig;
  timestamps: Date[];
  zones: ResilienceZoneSeries[];
  outageStartIndex: number;
  outageEndIndex: number;
}

export interface HeatIndexMetric {
  cautionHours: number;
  extremeCautionHours: number;
  dangerHours: number;
  extremeDangerHours: number;
  passesHeatIndexCriterion: boolean;
}

export interface WinterSetMetric {
  degreeHoursKH: number;
  degreeHoursFH: number;
  passesSetCriterion: boolean;
}

export const HEAT_INDEX_THRESHOLDS_C = {
  caution: 26.7,
  extremeCaution: 32.2,
  danger: 39.4,
  extremeDanger: 51.7,
} as const;

export const WINTER_SET_THRESHOLD_C = (54 - 32) / 1.8;
export const WINTER_SET_LIMIT_K_H = 120;
export const SUPPORTED_RESILIENCE_PROTOCOL = "Phius REVIVE 2024 v24.1.1";

const RESILIENCE_DIR = path.join("public", "downloads", "resilience");
const FILENAMES: Record<ResilienceKind, string> = {
  summer: "summer-heat-index.csv",
  winter: "winter-set.csv",
};

export async function loadResilienceSeries(
  kind: ResilienceKind,
  root = process.cwd(),
): Promise<ResilienceSeries> {
  const directory = path.resolve(root, RESILIENCE_DIR);
  const manifestPath = path.join(directory, "resilience.json");
  const manifest = parseResilienceManifest(await readRequiredFile(manifestPath), manifestPath);
  const config = manifest.series[kind];
  const csvPath = path.join(directory, config.filename);
  const parsed = parseResilienceCsv(await readRequiredFile(csvPath), csvPath, config.zones);
  const outageStart = parseUtcTimestamp(config.outage_start, `${manifestPath}: ${kind}.outage_start`);
  const outageStartIndex = parsed.timestamps.findIndex((timestamp) => timestamp.getTime() === outageStart.getTime());
  if (outageStartIndex < 0) {
    throw new Error(`${csvPath}: outage start ${config.outage_start} is not present in the Date column.`);
  }
  const outageEndIndex = outageStartIndex + config.outage_hours;
  if (outageEndIndex > parsed.timestamps.length) {
    throw new Error(
      `${csvPath}: ${config.outage_hours}-hour outage starting ${config.outage_start} exceeds the available series.`,
    );
  }

  return {
    kind,
    manifest,
    config,
    ...parsed,
    outageStartIndex,
    outageEndIndex,
  };
}

export function heatIndexMetrics(series: ResilienceSeries): Record<string, HeatIndexMetric> {
  return Object.fromEntries(
    series.zones.map((zone) => {
      const values = zone.values.slice(series.outageStartIndex, series.outageEndIndex);
      const metric = {
        cautionHours: countRange(values, HEAT_INDEX_THRESHOLDS_C.caution, HEAT_INDEX_THRESHOLDS_C.extremeCaution),
        extremeCautionHours: countRange(
          values,
          HEAT_INDEX_THRESHOLDS_C.extremeCaution,
          HEAT_INDEX_THRESHOLDS_C.danger,
        ),
        dangerHours: countRange(values, HEAT_INDEX_THRESHOLDS_C.danger, HEAT_INDEX_THRESHOLDS_C.extremeDanger),
        extremeDangerHours: values.filter((value) => value >= HEAT_INDEX_THRESHOLDS_C.extremeDanger).length,
        passesHeatIndexCriterion: values.every((value) => value < HEAT_INDEX_THRESHOLDS_C.danger),
      };
      return [zone.id, metric];
    }),
  );
}

export function winterSetMetrics(series: ResilienceSeries): Record<string, WinterSetMetric> {
  return Object.fromEntries(
    series.zones.map((zone) => {
      const degreeHoursKH = zone.values
        .slice(series.outageStartIndex, series.outageEndIndex)
        .reduce((total, value) => total + Math.max(WINTER_SET_THRESHOLD_C - value, 0), 0);
      return [
        zone.id,
        {
          degreeHoursKH,
          degreeHoursFH: degreeHoursKH * 1.8,
          passesSetCriterion: degreeHoursKH <= WINTER_SET_LIMIT_K_H,
        },
      ];
    }),
  );
}

async function readRequiredFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Missing Resilience input: ${filePath}`);
    }
    throw error;
  }
}

function parseResilienceManifest(text: string, filePath: string): ResilienceManifest {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`${filePath}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(value)) {
    throw new Error(`${filePath}: root must be an object.`);
  }
  if (value.schema_version !== "1.0.0") {
    throw new Error(`${filePath}: schema_version must be "1.0.0".`);
  }
  if (value.timezone !== "UTC") {
    throw new Error(`${filePath}: timezone must be "UTC".`);
  }
  if (value.protocol !== SUPPORTED_RESILIENCE_PROTOCOL) {
    throw new Error(`${filePath}: protocol must be "${SUPPORTED_RESILIENCE_PROTOCOL}".`);
  }
  const generatedAt = requiredString(value.generated_at, `${filePath}: generated_at`);
  parseUtcTimestamp(generatedAt, `${filePath}: generated_at`);
  if (!isRecord(value.series)) {
    throw new Error(`${filePath}: series must be an object.`);
  }

  return {
    schema_version: "1.0.0",
    protocol: SUPPORTED_RESILIENCE_PROTOCOL,
    timezone: "UTC",
    generated_at: generatedAt,
    series: {
      summer: parseSeriesConfig(value.series.summer, "summer", filePath),
      winter: parseSeriesConfig(value.series.winter, "winter", filePath),
    },
  };
}

function parseSeriesConfig(value: unknown, kind: ResilienceKind, filePath: string): ResilienceSeriesConfig {
  const location = `${filePath}: series.${kind}`;
  if (!isRecord(value)) {
    throw new Error(`${location} must be an object.`);
  }
  if (value.filename !== FILENAMES[kind]) {
    throw new Error(`${location}.filename must be "${FILENAMES[kind]}".`);
  }
  if (value.outage_hours !== 168) {
    throw new Error(`${location}.outage_hours must be 168.`);
  }
  const outageStart = requiredString(value.outage_start, `${location}.outage_start`);
  parseUtcTimestamp(outageStart, `${location}.outage_start`);
  if (!Array.isArray(value.zones) || value.zones.length === 0) {
    throw new Error(`${location}.zones must be a non-empty list.`);
  }
  const zones = value.zones.map((zone, index) => parseZone(zone, `${location}.zones[${index}]`));
  assertUnique(zones, (zone) => zone.id, `${location} zone id`);
  assertUnique(zones, (zone) => String(zone.order), `${location} zone order`);

  return {
    filename: value.filename,
    source: requiredString(value.source, `${location}.source`),
    generator: requiredString(value.generator, `${location}.generator`),
    outage_start: outageStart,
    outage_hours: 168,
    zones: zones.sort((left, right) => left.order - right.order),
  };
}

function parseZone(value: unknown, location: string): ResilienceZoneConfig {
  if (!isRecord(value)) {
    throw new Error(`${location} must be an object.`);
  }
  if (!Number.isInteger(value.order) || Number(value.order) < 1) {
    throw new Error(`${location}.order must be a positive integer.`);
  }
  return {
    id: requiredString(value.id, `${location}.id`),
    label: requiredString(value.label, `${location}.label`),
    order: Number(value.order),
  };
}

function parseResilienceCsv(text: string, filePath: string, zones: ResilienceZoneConfig[]) {
  const rows = csvParse(text);
  const expectedColumns = ["Date", ...zones.map((zone) => zone.id)];
  assertUnique(rows.columns, (column) => column, `${filePath} column`);
  const actual = new Set(rows.columns);
  const missing = expectedColumns.filter((column) => !actual.has(column));
  const extra = rows.columns.filter((column) => !expectedColumns.includes(column));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${filePath}: columns do not match resilience.json` +
        `${missing.length > 0 ? `; missing: ${missing.join(", ")}` : ""}` +
        `${extra.length > 0 ? `; extra: ${extra.join(", ")}` : ""}.`,
    );
  }
  if (rows.length < 168) {
    throw new Error(`${filePath}: expected at least 168 hourly rows; received ${rows.length}.`);
  }

  const timestamps = rows.map((row, rowIndex) => parseUtcTimestamp(row.Date, `${filePath}:${rowIndex + 2}:Date`));
  for (let index = 1; index < timestamps.length; index += 1) {
    const interval = timestamps[index].getTime() - timestamps[index - 1].getTime();
    if (interval !== 3_600_000) {
      throw new Error(`${filePath}:${index + 2}: Date values must be unique, increasing, and exactly one hour apart.`);
    }
  }

  const zoneSeries = zones.map((zone) => ({
    ...zone,
    values: rows.map((row, rowIndex) => {
      const raw = row[zone.id];
      if (raw === undefined || raw.trim() === "" || !Number.isFinite(Number(raw))) {
        throw new Error(`${filePath}:${rowIndex + 2}:${zone.id}: expected a finite numeric value; received "${raw ?? ""}".`);
      }
      return Number(raw);
    }),
  }));

  return { timestamps, zones: zoneSeries };
}

function parseUtcTimestamp(value: unknown, location: string): Date {
  if (typeof value !== "string" || !/(?:Z|[+-]00:00)$/.test(value)) {
    throw new Error(`${location} must be a timestamp with an explicit UTC offset.`);
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`${location} is not a valid timestamp.`);
  }
  return timestamp;
}

function requiredString(value: unknown, location: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${location} must be a non-blank string.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertUnique<T>(values: readonly T[], key: (value: T) => string, label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    const item = key(value);
    if (seen.has(item)) {
      throw new Error(`Duplicate ${label} "${item}".`);
    }
    seen.add(item);
  }
}

function countRange(values: readonly number[], minimum: number, maximum: number): number {
  return values.filter((value) => value >= minimum && value < maximum).length;
}
