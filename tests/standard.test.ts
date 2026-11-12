import { describe, expect, it } from "vitest";

import {
  KWH_PER_M2_TO_KBTU_PER_FT2,
  displayForReport,
  reportStandard,
  standardDisplay,
  standardLabel,
} from "../src/data/standard";

describe("reportStandard", () => {
  it("follows the recommended certification pathway", () => {
    expect(reportStandard({ target_standard: "PHI", certification_pathways: { recommended: "phius-zero-2024" } })).toBe(
      "phius",
    );
    expect(reportStandard({ target_standard: "Phius", certification_pathways: { recommended: "phi-leb" } })).toBe("phi");
  });

  it("falls back to target_standard when no pathway is recommended", () => {
    expect(reportStandard({ target_standard: "Phius", certification_pathways: { recommended: null } })).toBe("phius");
    expect(reportStandard({ target_standard: "Passive House" })).toBe("phi");
    expect(reportStandard(undefined)).toBe("phi");
  });
});

describe("standardDisplay", () => {
  it("keeps the existing PHI labels by default", () => {
    const display = standardDisplay({ target_standard: "PHI" });
    expect(display.floorAreaLabel).toBe("TFA");
    expect(display.limitLabel).toBe("PH-Limit");
    expect(display.specificDemandFactor).toBe(1);
  });

  it("switches to Phius labels and IP specific demand for Phius projects", () => {
    const display = standardDisplay({ target_standard: "Phius", certification_pathways: { recommended: "phius-core-2024" } });
    expect(display.floorAreaLabel).toBe("iCFA");
    expect(display.thresholdsTitle).toBe("Phius thresholds");
    expect(display.specificDemandUnits).toBe("kBtu/ft2-yr");
    // 34.385 kWh/m² is the 10.9 kBtu/ft² Phius heating limit.
    expect(34.385 * display.specificDemandFactor).toBeCloseTo(10.9, 2);
  });

  it("reads the project config from report data", () => {
    expect(displayForReport({ project: { target_standard: "Phius" } }).standard).toBe("phius");
    expect(displayForReport({}).standard).toBe("phi");
  });
});

describe("standardLabel", () => {
  it("relabels TFA only for Phius reports", () => {
    const phius = standardDisplay({ target_standard: "Phius" });
    const phi = standardDisplay({ target_standard: "PHI" });
    expect(standardLabel("Envelope Area To TFA", phius)).toBe("Envelope Area To iCFA");
    expect(standardLabel("TFA", phi)).toBe("TFA");
  });
});

it("converts kWh/m² to kBtu/ft²", () => {
  expect(KWH_PER_M2_TO_KBTU_PER_FT2).toBeCloseTo(0.317, 3);
});
