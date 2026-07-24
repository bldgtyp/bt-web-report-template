import { describe, expect, it } from "vitest";

import { certificationTarget } from "../src/charts/certification-target";
import type { ReportData } from "../src/data/report-loader";

describe("certificationTarget", () => {
  it("uses the recommended variant rather than the first positive limit", () => {
    const data = reportData(
      [
        { id: "leb", name: "Low Energy Building", order: 0 },
        { id: "classic", name: "PHI Classic", order: 1, recommended: true },
      ],
      [
        limit("leb", "heat_demand", 30),
        limit("leb", "total_cooling_demand", 30),
        limit("classic", "heat_demand", 15),
        limit("classic", "total_cooling_demand", 15),
        limit("classic", "peak_heat_load", 10),
        limit("classic", "peak_cooling_load", 8.83),
      ],
    );

    expect(certificationTarget(data)).toEqual({
      limits: {
        heat_demand: 15,
        total_cooling_demand: 15,
        peak_heat_load: 10,
        peak_cooling_load: 8.83,
      },
      variantId: "classic",
      variantName: "PHI Classic",
    });
  });

  it("preserves custom 40-Other targets from the recommended variant", () => {
    const data = reportData(
      [
        { id: "code", name: "Code Minimum", order: 0 },
        { id: "custom", name: "Passive House", order: 1, recommended: true },
      ],
      [
        limit("code", "heat_demand", 15),
        limit("code", "peak_heat_load", 10),
        limit("custom", "heat_demand", 10_881.4),
        limit("custom", "total_cooling_demand", 9_079.88),
        limit("custom", "peak_heat_load", 7_371.27),
        limit("custom", "peak_cooling_load", 3_654.1),
      ],
    );

    expect(certificationTarget(data).limits).toEqual({
      heat_demand: 10_881.4,
      total_cooling_demand: 9_079.88,
      peak_heat_load: 7_371.27,
      peak_cooling_load: 3_654.1,
    });
  });

  it("returns null limits for EnerPHit by Component even when Variants row 368 remains populated", () => {
    const data = reportData(
      [
        { id: "classic", name: "PHI Classic", order: 0 },
        { id: "component", name: "EnerPHit by Component", order: 1, recommended: true },
      ],
      [
        limit("classic", "heat_demand", 15),
        limit("classic", "total_cooling_demand", 15),
        limit("classic", "peak_heat_load", 10),
        limit("component", "heat_demand", 0),
        limit("component", "total_cooling_demand", 0),
        limit("component", "peak_heat_load", 0),
        limit("component", "peak_cooling_load", 8.83),
      ],
    );

    expect(certificationTarget(data).limits).toEqual({
      heat_demand: null,
      total_cooling_demand: null,
      peak_heat_load: null,
      peak_cooling_load: null,
    });
  });

  it("keeps the historical peak-heat fallback scoped to the target variant", () => {
    const data = reportData(
      [{ id: "demand", name: "EnerPHit by Demand", order: 0, recommended: true }],
      [
        limit("demand", "heat_demand", 5_805.29),
        limit("demand", "peak_heat_load", 0),
        limit("demand", "peak_cooling_load", 2_564.2),
      ],
    );

    expect(certificationTarget(data).limits.peak_heat_load).toBeCloseTo((5_805.29 / 15) * 10);
  });
});

function reportData(variants: ReportData["variantOrder"], certification: ReportData["certification"]): ReportData {
  return {
    manifest: {
      status: "ok",
      variants,
    },
    variantOrder: variants,
    buildingMetrics: [],
    certification,
    climateMonthly: [],
    demandDetail: [],
    energy: [],
    roomAirflows: [],
    variants: [],
  };
}

function limit(variantId: string, metric: string, value: number): ReportData["certification"][number] {
  return {
    metric,
    role: "limit",
    units: metric.includes("load") ? "W" : "kWh",
    value,
    variant_id: variantId,
  };
}
