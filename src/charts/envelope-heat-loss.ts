// Heating-season transmission loss per envelope assembly as a function of its
// R-value: Q = A · U · Gt, with U = 5.678 / R.
//
// Areas come from `envelope-areas.csv` (one row per assembly and PHPP group;
// `envelope_field_id` names the Variants ENVELOPE row that carries the
// assembly's per-variant R-value). Gt comes from the Variants R-VALUES block:
// `r_values.gt_a` for surfaces against ambient air (groups 8, 10, 12) and
// `r_values.gt_b` for surfaces against the ground (groups 9, 11). The
// workbook labels both "kFh/y", but they are PHPP's kKh/a — m² · W/(m²K) · kKh
// is kWh, which is what the Heating worksheet reproduces.
import type { CsvRow } from "../data/csv";
import type { ReportVariant } from "../data/manifest";
import { cellNumber, cellText } from "../data/rows";

/** U [W/(m²K)] = W_PER_M2K_PER_R / R [hr·ft²·°F/Btu]. */
export const W_PER_M2K_PER_R = 5.678;

export interface HeatLossMarker {
  variantId: string;
  rValue: number;
  heatLoss: number;
}

export interface AssemblyHeatLossSeries {
  fieldId: string;
  label: string;
  /** Total area of the ambient- and ground-facing surfaces, ft². */
  areaFt2: number;
  /** Σ area_m2 · Gt over the assembly's groups, so Q(R) = areaGt · 5.678 / R. */
  areaGt: number;
  markers: HeatLossMarker[];
}

export interface EnvelopeHeatLossInput {
  areas: CsvRow[];
  variants: CsvRow[];
  variantOrder: ReportVariant[];
  /** Variant whose Gt scales every curve; markers of all variants share it. */
  gtVariantId: string;
}

export interface EnvelopeHeatLoss {
  gtA: number | null;
  gtB: number | null;
  series: AssemblyHeatLossSeries[];
  /** Assemblies with ambient/ground area but no Variants R-value row. */
  unmatched: string[];
  /** Assemblies whose surfaces face neither ambient air nor ground (party walls). */
  excluded: string[];
}

export function heatLossAtR(areaGt: number, rValue: number): number {
  if (rValue <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return (areaGt * W_PER_M2K_PER_R) / rValue;
}

/** R at which the curve reaches a given heat loss; used to clip curves at the plot top. */
export function rValueAtHeatLoss(areaGt: number, heatLoss: number): number {
  if (heatLoss <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return (areaGt * W_PER_M2K_PER_R) / heatLoss;
}

export function envelopeHeatLoss(input: EnvelopeHeatLossInput): EnvelopeHeatLoss {
  const gtA = variantValue(input.variants, "r_values.gt_a", input.gtVariantId);
  const gtB = variantValue(input.variants, "r_values.gt_b", input.gtVariantId);
  const empty: EnvelopeHeatLoss = { gtA, gtB, series: [], unmatched: [], excluded: [] };
  if (gtA === null || gtB === null) {
    return empty;
  }

  const byField = new Map<string, { label: string; areaFt2: number; areaGt: number }>();
  const unmatched = new Set<string>();
  const excluded = new Set<string>();

  for (const row of input.areas) {
    const exposure = cellText(row, "exposure");
    const name = cellText(row, "assembly_name") || cellText(row, "assembly_id");
    const areaM2 = cellNumber(row, "area_m2");
    if (areaM2 === null || areaM2 <= 0) {
      continue;
    }
    if (exposure !== "A" && exposure !== "B") {
      excluded.add(name);
      continue;
    }
    const fieldId = cellText(row, "envelope_field_id");
    if (!fieldId) {
      unmatched.add(name);
      continue;
    }
    const entry = byField.get(fieldId) ?? { label: name, areaFt2: 0, areaGt: 0 };
    entry.areaFt2 += cellNumber(row, "area_ft2") ?? 0;
    entry.areaGt += areaM2 * (exposure === "A" ? gtA : gtB);
    byField.set(fieldId, entry);
  }

  const series: AssemblyHeatLossSeries[] = [];
  for (const [fieldId, entry] of byField) {
    const rRows = input.variants.filter((row) => cellText(row, "field_id") === fieldId);
    const label = rRows.map((row) => cellText(row, "datatype")).find((text) => text) || stripKeyPrefix(entry.label);
    const markers: HeatLossMarker[] = [];
    for (const variant of input.variantOrder) {
      const rRow = rRows.find((row) => cellText(row, "variant_id") === variant.id);
      const rValue = rRow ? cellNumber(rRow, "value") : null;
      if (rValue !== null && rValue > 0) {
        markers.push({ variantId: variant.id, rValue, heatLoss: heatLossAtR(entry.areaGt, rValue) });
      }
    }
    if (markers.length === 0) {
      unmatched.add(label);
      continue;
    }
    series.push({ fieldId, label, areaFt2: entry.areaFt2, areaGt: entry.areaGt, markers });
  }
  series.sort((a, b) => b.areaGt - a.areaGt);

  // An assembly that is partly ambient and partly ground must not be reported
  // as excluded when its ambient part was plotted.
  for (const plotted of series) {
    excluded.delete(plotted.label);
  }

  return { gtA, gtB, series, unmatched: [...unmatched].sort(), excluded: [...excluded].sort() };
}

function variantValue(rows: CsvRow[], fieldId: string, variantId: string): number | null {
  const row = rows.find((candidate) => cellText(candidate, "field_id") === fieldId && cellText(candidate, "variant_id") === variantId);
  return row ? cellNumber(row, "value") : null;
}

/** U-values block names can carry the Variants key letter: "c-W-CS - Crawlspace" → "W-CS - Crawlspace". */
function stripKeyPrefix(name: string): string {
  return name.replace(/^[a-z]-/, "");
}
