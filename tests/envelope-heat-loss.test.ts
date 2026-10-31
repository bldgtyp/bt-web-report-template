import { describe, expect, it } from "vitest";

import { envelopeHeatLoss, heatLossAtR, rValueAtHeatLoss } from "../src/charts/envelope-heat-loss";
import type { CsvRow } from "../src/data/csv";
import type { ReportVariant } from "../src/data/manifest";

const variantOrder: ReportVariant[] = [
  { id: "code_minimum", name: "Code Minimum", order: 0, recommended: false, source_column: "G" },
  { id: "phius_2024", name: "Phius 2024", order: 1, recommended: true, source_column: "H" },
];

function variantRow(fieldId: string, variantId: string, value: number, datatype = ""): CsvRow {
  return { section: fieldId.split(".")[0], field_id: fieldId, variant_id: variantId, datatype, units: "", value };
}

function areaRow(assemblyId: string, name: string, fieldId: string, group: number, exposure: string, areaM2: number): CsvRow {
  return {
    assembly_id: assemblyId,
    assembly_name: name,
    envelope_field_id: fieldId,
    group_number: group,
    exposure,
    area_m2: areaM2,
    area_ft2: areaM2 * 10.76391042,
    surface_count: 1,
  };
}

const gtRows = [
  variantRow("r_values.gt_a", "phius_2024", 65),
  variantRow("r_values.gt_b", "phius_2024", 25),
  variantRow("r_values.gt_a", "code_minimum", 64),
  variantRow("r_values.gt_b", "code_minimum", 23),
];

describe("heatLossAtR", () => {
  it("reproduces area × U × Gt in kWh/yr and inverts cleanly", () => {
    // 10 m² at R-20 (U = 0.2839 W/m²K) over 65 kKh/a → 184.5 kWh/yr.
    expect(heatLossAtR(10 * 65, 20)).toBeCloseTo(184.535, 3);
    expect(rValueAtHeatLoss(10 * 65, 184.535)).toBeCloseTo(20, 3);
  });
});

describe("envelopeHeatLoss", () => {
  it("sums ambient and ground groups of one assembly with their own Gt", () => {
    const result = envelopeHeatLoss({
      areas: [
        areaRow("02ud", "Cellar-Wall", "envelope.floor_bg", 8, "A", 50),
        areaRow("02ud", "Cellar-Wall", "envelope.floor_bg", 9, "B", 130),
      ],
      variants: [
        ...gtRows,
        variantRow("envelope.floor_bg", "code_minimum", 20, "Cellar-Wall"),
        variantRow("envelope.floor_bg", "phius_2024", 22.5, "Cellar-Wall"),
      ],
      variantOrder,
      gtVariantId: "phius_2024",
    });

    expect(result.gtA).toBe(65);
    expect(result.gtB).toBe(25);
    expect(result.series).toHaveLength(1);
    const [wall] = result.series;
    expect(wall.label).toBe("Cellar-Wall");
    expect(wall.areaGt).toBe(50 * 65 + 130 * 25);
    expect(wall.areaFt2).toBeCloseTo(180 * 10.76391042, 6);
    expect(wall.markers.map((marker) => marker.variantId)).toEqual(["code_minimum", "phius_2024"]);
    expect(wall.markers[1].heatLoss).toBeCloseTo((wall.areaGt * 5.678) / 22.5, 6);
  });

  it("orders series by size and reports excluded and unmatched assemblies", () => {
    const result = envelopeHeatLoss({
      areas: [
        areaRow("01ud", "Roof-Deck", "envelope.roof", 10, "A", 15),
        areaRow("02ud", "Brick-Clad-Wall", "envelope.party_wall", 8, "A", 240),
        areaRow("06ud", "Partywall", "envelope.assembly_06", 18, "", 370),
        areaRow("07ud", "Garage Door", "", 8, "A", 4),
      ],
      variants: [
        ...gtRows,
        variantRow("envelope.roof", "phius_2024", 55.9, "Roof-Deck"),
        variantRow("envelope.party_wall", "phius_2024", 29.9, "Brick-Clad-Wall"),
      ],
      variantOrder,
      gtVariantId: "phius_2024",
    });

    expect(result.series.map((entry) => entry.label)).toEqual(["Brick-Clad-Wall", "Roof-Deck"]);
    expect(result.excluded).toEqual(["Partywall"]);
    expect(result.unmatched).toEqual(["Garage Door"]);
  });

  it("strips the Variants key letter from a U-values block name when no R-value label exists", () => {
    const result = envelopeHeatLoss({
      areas: [areaRow("01ud", "c-W-CS - Crawlspace", "envelope.party_wall", 9, "B", 60)],
      variants: [...gtRows, variantRow("envelope.party_wall", "phius_2024", 30)],
      variantOrder,
      gtVariantId: "phius_2024",
    });

    expect(result.series[0].label).toBe("W-CS - Crawlspace");
  });

  it("returns no series when the Gt rows are missing", () => {
    const result = envelopeHeatLoss({
      areas: [areaRow("01ud", "Wall", "envelope.wall_ag", 8, "A", 100)],
      variants: [variantRow("envelope.wall_ag", "phius_2024", 30, "Wall")],
      variantOrder,
      gtVariantId: "phius_2024",
    });

    expect(result.gtA).toBeNull();
    expect(result.series).toEqual([]);
  });
});
