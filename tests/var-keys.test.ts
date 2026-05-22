import { describe, expect, it } from "vitest";

import { listVarKeyOptions } from "@bldgtyp/web-report-schemas";

describe("listVarKeyOptions", () => {
  it("includes top-level project facts", () => {
    const opts = listVarKeyOptions();
    const byValue = new Map(opts.map((o) => [o.value, o.label]));

    expect(byValue.get("client_name")).toBe("Client Name");
    expect(byValue.get("building_name")).toBe("Building Name");
    expect(byValue.get("target_standard")).toBe("Target Standard");
  });

  it("descends into nested building / source_files / publishing groups", () => {
    const opts = listVarKeyOptions();
    const byValue = new Map(opts.map((o) => [o.value, o.label]));

    expect(byValue.get("building.address")).toBe("Building > Address");
    expect(byValue.get("building.climate_zone")).toBe("Building > Climate Zone");
    expect(byValue.get("publishing.production_url")).toBe("Publishing > Production Url");
  });

  it("includes every narrative section under its friendly title", () => {
    const opts = listVarKeyOptions();
    const byValue = new Map(opts.map((o) => [o.value, o.label]));

    expect(byValue.get("narrative.certification.target")).toBe("Narrative > Certification > Target");
    expect(byValue.get("narrative.climate.weather_station_name")).toBe(
      "Narrative > Climate > Weather Station Name",
    );
    expect(byValue.get("narrative.energy_code.ach_limit")).toBe("Narrative > Energy code > Ach Limit");
    expect(byValue.get("narrative.co2.subregion_name")).toBe("Narrative > CO2 > Subregion Name");
    expect(byValue.get("narrative.windows.ph_window_u_value")).toBe(
      "Narrative > Windows > Ph Window U Value",
    );
    expect(byValue.get("narrative.mechanical.erv.manufacturer_name")).toBe(
      "Narrative > Mechanical > ERV > Manufacturer Name",
    );
  });

  it("strips configured label segments without affecting dot-path values", () => {
    const opts = listVarKeyOptions({ stripLabelSegments: ["Narrative"] });
    const byValue = new Map(opts.map((o) => [o.value, o.label]));

    // Value stays the same — only the label is shortened.
    expect(byValue.get("narrative.certification.target")).toBe("Certification > Target");
    expect(byValue.get("narrative.mechanical.erv.manufacturer_name")).toBe(
      "Mechanical > ERV > Manufacturer Name",
    );
    // Top-level paths that don't contain "Narrative" are unchanged.
    expect(byValue.get("client_name")).toBe("Client Name");
    expect(byValue.get("building.city")).toBe("Building > City");
  });

  it("omits const-valued fields like schema_version", () => {
    const opts = listVarKeyOptions();
    const values = new Set(opts.map((o) => o.value));
    expect(values.has("schema_version")).toBe(false);
  });

  it("emits only string-typed leaves (no object containers)", () => {
    const opts = listVarKeyOptions();
    const values = new Set(opts.map((o) => o.value));
    expect(values.has("building")).toBe(false);
    expect(values.has("narrative")).toBe(false);
    expect(values.has("narrative.mechanical")).toBe(false);
    expect(values.has("narrative.mechanical.erv")).toBe(false);
    expect(values.has("narrative.user_defined")).toBe(false);
  });

  it("produces deterministic, unique dot-paths", () => {
    const opts = listVarKeyOptions();
    const values = opts.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
    expect(opts.length).toBeGreaterThan(40); // sanity-check coverage
  });
});
