import { describe, expect, it } from "vitest";

import type { CsvRow } from "../src/data/csv";
import { phiusCompliance, phiusComplianceLabel } from "../src/data/phius-compliance";

// Values from 2625 2500 Linden (Phius ZERO 2024), in the scraped units.
const LIMITS = { heat_demand: 19163, total_cooling_demand: 13537, peak_heat_load: 16526, peak_cooling_load: 6153 };

function variant(
  id: string,
  results: { heat_demand: number; total_cooling_demand: number; peak_heat_load: number; peak_cooling_load: number },
  netSource: number,
  q50: number,
) {
  const certification: CsvRow[] = Object.entries(results).flatMap(([metric, value]) => [
    { metric, role: "result", variant_id: id, value },
    { metric, role: "limit", variant_id: id, value: LIMITS[metric as keyof typeof LIMITS] },
  ]);
  const energy: CsvRow[] = [
    { metric_group: "phius_net_source_energy", end_use: "total", variant_id: id, value: netSource },
    { metric_group: "phius_net_source_energy", end_use: "limit", variant_id: id, value: 39300 },
  ];
  const variants: CsvRow[] = [
    { field_id: "report_inputs.envelope_air_leakage_rate_q50", variant_id: id, value: q50 },
  ];
  return { certification, energy, variants };
}

const BUILDING = { heat_demand: 17451, total_cooling_demand: 5772, peak_heat_load: 12614, peak_cooling_load: 4078 };

describe("phiusCompliance", () => {
  it("fails a building that meets the space-conditioning limits but not the source energy limit", () => {
    const result = phiusCompliance(variant("shading", BUILDING, 42704, 0.0599862), "shading");
    expect(result).toEqual({ level: "none", failures: ["source energy"] });
    expect(phiusComplianceLabel(result)).toBe("No");
  });

  it("passes CORE when net source energy is within the CORE limit", () => {
    const result = phiusCompliance(variant("core", BUILDING, 35912, 0.0599862), "core");
    expect(result.level).toBe("core");
    expect(phiusComplianceLabel(result)).toBe("Yes – Phius CORE");
  });

  it("passes ZERO when net source energy is zero or less", () => {
    const result = phiusCompliance(variant("zero", BUILDING, -4176, 0.0599862), "zero");
    expect(result.level).toBe("zero");
    expect(phiusComplianceLabel(result)).toBe("Yes – Phius ZERO");
  });

  it("fails on heating demand and airtightness", () => {
    const result = phiusCompliance(
      variant("code", { ...BUILDING, heat_demand: 58380, peak_heat_load: 32071 }, 74372, 0.173),
      "code",
    );
    expect(result.failures).toEqual(["heating demand", "peak heating load", "source energy", "airtightness"]);
  });

  it("treats missing data as non-compliant", () => {
    expect(phiusCompliance({ certification: [], energy: [], variants: [] }, "x").level).toBe("none");
  });
});
