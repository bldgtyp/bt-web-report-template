import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseCsv, type CsvRow } from "./csv";
import { isReportManifest, normalizeVariants, type ReportManifest, type ReportVariant } from "./manifest";

export type ReportDataKey =
  | "buildingMetrics"
  | "certification"
  | "climateMonthly"
  | "demandDetail"
  | "energy"
  | "roomAirflows"
  | "variants";

export interface ReportData {
  manifest: ReportManifest;
  variantOrder: ReportVariant[];
  buildingMetrics: CsvRow[];
  certification: CsvRow[];
  climateMonthly: CsvRow[];
  demandDetail: CsvRow[];
  energy: CsvRow[];
  roomAirflows: CsvRow[];
  variants: CsvRow[];
}

const CSV_FILES: Record<ReportDataKey, string> = {
  buildingMetrics: "building-metrics.csv",
  certification: "certification.csv",
  climateMonthly: "climate-monthly.csv",
  demandDetail: "demand-detail.csv",
  energy: "energy.csv",
  roomAirflows: "room-airflows.csv",
  variants: "variants.csv",
};

export async function loadReportData(dataDir: string): Promise<ReportData> {
  const manifest = await loadManifest(dataDir);
  const variantOrder = normalizeVariants(manifest);
  const csvEntries = await Promise.all(
    Object.entries(CSV_FILES).map(
      async ([key, filename]) => [key, await loadCsvFile(join(dataDir, filename))] as const,
    ),
  );

  return {
    manifest,
    variantOrder,
    ...(Object.fromEntries(
      csvEntries.map(([key, rows]) => [key, orderVariantRows(rows, variantOrder)]),
    ) as Record<ReportDataKey, CsvRow[]>),
  };
}

async function loadManifest(dataDir: string): Promise<ReportManifest> {
  const manifestText = await readFile(join(dataDir, "manifest.json"), "utf8");
  const manifest = JSON.parse(manifestText) as unknown;

  if (!isReportManifest(manifest)) {
    throw new Error(`Invalid report manifest in ${dataDir}`);
  }

  return manifest;
}

async function loadCsvFile(path: string): Promise<CsvRow[]> {
  try {
    return parseCsv(await readFile(path, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function orderVariantRows(rows: CsvRow[], variants: ReportVariant[]): CsvRow[] {
  const order = new Map(variants.map((variant, index) => [variant.id, index]));
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const aVariant = variantRank(a.row, order);
      const bVariant = variantRank(b.row, order);
      return aVariant - bVariant || a.index - b.index;
    })
    .map(({ row }) => row);
}

function variantRank(row: CsvRow, order: Map<string, number>): number {
  const variantId = row.variant_id;
  return typeof variantId === "string" ? order.get(variantId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
}
