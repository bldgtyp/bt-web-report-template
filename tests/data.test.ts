import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { coerceCsvCell, parseCsv } from "../src/data/csv";
import { loadReportData } from "../src/data/report-loader";
import { formatValue, labelize, siteEnergyGroupForEndUse, siteEnergyGroups, variantColorMap } from "../src/data/rows";

describe("CSV helpers", () => {
  it("coerces numeric fields while preserving blank fields", () => {
    expect(coerceCsvCell("12.5")).toBe(12.5);
    expect(coerceCsvCell("")).toBe("");
    expect(coerceCsvCell(undefined)).toBeNull();
    expect(coerceCsvCell("Code Minimum")).toBe("Code Minimum");
  });

  it("parses long-format rows", () => {
    expect(parseCsv("metric,value\nfoo,1\nbar,\n")).toEqual([
      { metric: "foo", value: 1 },
      { metric: "bar", value: "" },
    ]);
  });
});

describe("loadReportData", () => {
  it("loads the Vandam showcase fixture", async () => {
    const dataDir = fileURLToPath(new URL("../../test-files/phpp/2606-Vandam-St/scrape-output", import.meta.url));
    const data = await loadReportData(dataDir);

    expect(data.manifest.status).toBe("ok");
    expect(data.variantOrder.map((variant) => variant.id)).toEqual([
      "code_minimum",
      "improved_envelope",
      "improved_hvac",
      "enerphit_by_component",
      "enerphit_by_demand",
    ]);
    expect(data.variantOrder[4].recommended).toBe(true);
    expect(data.buildingMetrics).toHaveLength(60);
    expect(data.certification).toHaveLength(85);
    expect(data.energy).toHaveLength(410);
    expect(data.variants).toHaveLength(865);
  });

  it("loads the Linde secondary fixture", async () => {
    const dataDir = fileURLToPath(new URL("../../test-files/phpp/2524-Linde-Residence/scrape-output", import.meta.url));
    const data = await loadReportData(dataDir);

    expect(data.variantOrder.map((variant) => variant.id)).toEqual([
      "code_min",
      "improved",
      "phi_leb",
      "phi_classic",
      "as_drawn",
    ]);
    expect(data.roomAirflows).toHaveLength(29);
  });

  it("returns empty arrays for missing optional CSV files", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "btwr-kit-"));
    await writeFile(
      join(dataDir, "manifest.json"),
      JSON.stringify({
        status: "pending",
        variants: [{ id: "base", name: "Base", order: 0 }],
      }),
    );

    const data = await loadReportData(dataDir);

    expect(data.manifest.status).toBe("pending");
    expect(data.energy).toEqual([]);
    expect(data.roomAirflows).toEqual([]);
    expect(data.variantOrder).toEqual([{ id: "base", name: "Base", order: 0, recommended: false }]);
  });

  it("normalizes variants and CSV rows by PHPP source-column order", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "btwr-kit-"));
    await writeFile(
      join(dataDir, "manifest.json"),
      JSON.stringify({
        status: "ok",
        recommended_variant_id: "middle",
        variants: [
          { id: "right", name: "Right", order: 0, source_column: "H" },
          { id: "left", name: "Left", order: 10, source_column: "F" },
          { id: "middle", name: "Middle", order: 5, source_column: "G" },
        ],
      }),
    );
    await writeFile(
      join(dataDir, "energy.csv"),
      "metric_group,end_use,variant_id,units,value\nsite_energy,heating,right,kWh,3\nsite_energy,heating,left,kWh,1\nsite_energy,heating,middle,kWh,2\n",
    );

    const data = await loadReportData(dataDir);

    expect(data.variantOrder.map((variant) => variant.id)).toEqual(["left", "middle", "right"]);
    expect(data.variantOrder[1].recommended).toBe(true);
    expect(data.energy.map((row) => row.variant_id)).toEqual(["left", "middle", "right"]);
  });
});

describe("row formatting helpers", () => {
  it("formats PH labels and report values", () => {
    expect(labelize("per_demand")).toBe("PER Demand");
    expect(labelize("dhw")).toBe("DHW");
    expect(formatValue(3124.3805, "ft2")).toBe("3,124 ft2");
  });

  it("creates stable variant-color maps from manifest order", () => {
    expect(
      [...variantColorMap([
        { id: "a", name: "A", order: 0 },
        { id: "b", name: "B", order: 1, recommended: true },
      ]).entries()],
    ).toEqual([
      ["a", "var(--btwr-chart-variant-1)"],
      ["b", "var(--btwr-chart-variant-2)"],
    ]);
  });

  it("maps PHPP site-energy end uses to the six report groups", () => {
    expect(siteEnergyGroups().map((group) => group.label)).toEqual([
      "Heating",
      "Cooling",
      "DHW",
      "Elec Lights",
      "Elec Equip",
      "Pumps / Fans",
    ]);
    expect(siteEnergyGroupForEndUse("PHI Small Appliances")?.label).toBe("Elec Equip");
    expect(siteEnergyGroupForEndUse("Aux Elec")?.label).toBe("Pumps / Fans");
    expect(siteEnergyGroupForEndUse("Solar PV")).toBeNull();
  });
});
