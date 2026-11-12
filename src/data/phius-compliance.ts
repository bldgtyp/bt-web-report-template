import type { CsvRow } from "./csv";
import { cellNumber, cellText } from "./rows";

/**
 * Phius performance-path compliance for one variant, evaluated from the scraped
 * PHPP results:
 *
 * - CORE: heating demand, total cooling demand, peak heating load and peak
 *   cooling load each at or below their limits (certification.csv), net source
 *   energy at or below the CORE limit (energy.csv), and envelope air leakage at
 *   or below the Phius cfm50/ft² limit.
 * - ZERO: everything CORE requires, plus net source energy of zero or less.
 *
 * A check whose result or limit is missing makes the variant non-compliant
 * rather than silently passing.
 */
export type PhiusLevel = "zero" | "core" | "none";

export interface PhiusComplianceInputs {
  certification: CsvRow[];
  energy: CsvRow[];
  variants: CsvRow[];
}

export interface PhiusCompliance {
  level: PhiusLevel;
  /** Names of the CORE checks that failed (or could not be evaluated). */
  failures: string[];
}

const SPACE_CONDITIONING_METRICS = [
  ["heat_demand", "heating demand"],
  ["total_cooling_demand", "cooling demand"],
  ["peak_heat_load", "peak heating load"],
  ["peak_cooling_load", "peak cooling load"],
] as const;

const AIR_LEAKAGE_FIELD = "report_inputs.envelope_air_leakage_rate_q50";
const DEFAULT_CFM50_LIMIT = 0.06;
// Results are compared after rounding to the precision Phius reports them at,
// so a modeled 0.0599862 cfm50/ft² meets a 0.06 limit.
const TOLERANCE = 1e-6;

function certificationValue(rows: CsvRow[], variantId: string, metric: string, role: string): number | null {
  const row = rows.find(
    (candidate) =>
      cellText(candidate, "variant_id") === variantId &&
      cellText(candidate, "metric") === metric &&
      cellText(candidate, "role") === role,
  );
  return row ? cellNumber(row, "value") : null;
}

function energyValue(rows: CsvRow[], variantId: string, endUse: string): number | null {
  const row = rows.find(
    (candidate) =>
      cellText(candidate, "variant_id") === variantId &&
      cellText(candidate, "metric_group") === "phius_net_source_energy" &&
      cellText(candidate, "end_use") === endUse,
  );
  return row ? cellNumber(row, "value") : null;
}

function variantsValue(rows: CsvRow[], variantId: string, fieldId: string): number | null {
  const row = rows.find(
    (candidate) => cellText(candidate, "variant_id") === variantId && cellText(candidate, "field_id") === fieldId,
  );
  return row ? cellNumber(row, "value") : null;
}

function meets(result: number | null, limit: number | null): boolean {
  return result !== null && limit !== null && result <= limit + TOLERANCE * Math.max(1, Math.abs(limit));
}

export function phiusCompliance(
  data: PhiusComplianceInputs,
  variantId: string,
  cfm50Limit: number | null = DEFAULT_CFM50_LIMIT,
): PhiusCompliance {
  const failures: string[] = [];

  for (const [metric, label] of SPACE_CONDITIONING_METRICS) {
    const result = certificationValue(data.certification, variantId, metric, "result");
    const limit = certificationValue(data.certification, variantId, metric, "limit");
    if (!meets(result, limit === null || limit <= 0 ? null : limit)) failures.push(label);
  }

  const netSource = energyValue(data.energy, variantId, "total");
  const sourceLimit = energyValue(data.energy, variantId, "limit");
  if (!meets(netSource, sourceLimit === null || sourceLimit <= 0 ? null : sourceLimit)) failures.push("source energy");

  const airLeakage = variantsValue(data.variants, variantId, AIR_LEAKAGE_FIELD);
  if (!meets(airLeakage, cfm50Limit ?? DEFAULT_CFM50_LIMIT)) failures.push("airtightness");

  if (failures.length > 0) return { level: "none", failures };
  return { level: netSource !== null && netSource <= 0 ? "zero" : "core", failures };
}

export function phiusComplianceLabel(compliance: PhiusCompliance): string {
  if (compliance.level === "zero") return "Yes – Phius ZERO";
  if (compliance.level === "core") return "Yes – Phius CORE";
  return "No";
}
