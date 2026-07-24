import type { ReportData } from "../data/report-loader";
import { cellNumber, cellText } from "../data/rows";
import { recommendedVariant } from "../data/variants";

export const CERTIFICATION_THRESHOLD_METRIC_IDS = [
  "heat_demand",
  "total_cooling_demand",
  "peak_heat_load",
  "peak_cooling_load",
] as const;

export type CertificationThresholdMetricId = (typeof CERTIFICATION_THRESHOLD_METRIC_IDS)[number];

export interface CertificationTarget {
  limits: Record<CertificationThresholdMetricId, number | null>;
  variantId: string | null;
  variantName: string | null;
}

export function certificationTarget(data: ReportData, variantId?: string): CertificationTarget {
  const targetVariant = variantId
    ? data.variantOrder.find((variant) => variant.id === variantId)
    : recommendedVariant(data.variantOrder);
  const targetVariantId = targetVariant?.id ?? null;

  if (targetVariantId === null) {
    return {
      limits: emptyLimits(),
      variantId: null,
      variantName: null,
    };
  }

  const heatDemand = positiveLimit(data, targetVariantId, "heat_demand");
  const totalCoolingDemand = positiveLimit(data, targetVariantId, "total_cooling_demand");
  const rawPeakHeatLoad = positiveLimit(data, targetVariantId, "peak_heat_load");
  const peakHeatLoad = rawPeakHeatLoad ?? (heatDemand === null ? null : (heatDemand / 15) * 10);

  // Variants!368 is sourced from Phius Data rather than Verification and can
  // remain populated when PHPP has no applicable demand/load criteria (for
  // example, EnerPHit by Component). Require at least one Verification-backed
  // target before treating that cooling-load value as applicable.
  const hasVerificationTarget = heatDemand !== null || totalCoolingDemand !== null || rawPeakHeatLoad !== null;
  const peakCoolingLoad = hasVerificationTarget ? positiveLimit(data, targetVariantId, "peak_cooling_load") : null;

  return {
    limits: {
      heat_demand: heatDemand,
      total_cooling_demand: totalCoolingDemand,
      peak_heat_load: peakHeatLoad,
      peak_cooling_load: peakCoolingLoad,
    },
    variantId: targetVariantId,
    variantName: targetVariant?.name ?? null,
  };
}

function positiveLimit(data: ReportData, variantId: string, metricId: CertificationThresholdMetricId): number | null {
  const row = data.certification.find(
    (candidate) =>
      cellText(candidate, "variant_id") === variantId &&
      cellText(candidate, "metric") === metricId &&
      cellText(candidate, "role") === "limit",
  );
  const value = row ? cellNumber(row, "value") : null;
  return value !== null && value > 0 ? value : null;
}

function emptyLimits(): Record<CertificationThresholdMetricId, null> {
  return {
    heat_demand: null,
    total_cooling_demand: null,
    peak_heat_load: null,
    peak_cooling_load: null,
  };
}
