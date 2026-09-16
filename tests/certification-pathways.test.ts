import projectSchema from "@bldgtyp/web-report-schemas/project.schema.json";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  certificationPathwayLogos,
  certificationPathways,
  DEFAULT_CERTIFICATION_PATHWAY_IDS,
  resolveCertificationPathwayRowValue,
  resolveCertificationPathways,
  type BoundCertificationPathwayRow,
} from "../src/data/certification-pathways";
import type { ProjectConfig } from "../src/data/project";

function project(certificationPathways?: ProjectConfig["certification_pathways"]): ProjectConfig {
  return { certification_pathways: certificationPathways } as ProjectConfig;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("certification pathway catalog", () => {
  it("has unique IDs and resolvable logo keys", () => {
    const ids = certificationPathways.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of certificationPathways) {
      expect(certificationPathwayLogos[entry.logo]).toBeDefined();
    }
  });

  it("uses only known narrative.certification fields for bound rows", () => {
    const certificationProperties = projectSchema.$defs.CertificationNarrative.properties;

    for (const entry of certificationPathways) {
      for (const section of entry.sections) {
        for (const row of section.rows) {
          if ("key" in row) {
            const field = row.key.replace("narrative.certification.", "");
            expect(row.key).toBe(`narrative.certification.${field}`);
            expect(certificationProperties).toHaveProperty(field);
          }
        }
      }
    }
  });

  it("defines every default as a catalog ID", () => {
    const ids = new Set(certificationPathways.map(({ id }) => id));
    expect(DEFAULT_CERTIFICATION_PATHWAY_IDS.every((id) => ids.has(id))).toBe(true);
  });
});

describe("resolveCertificationPathways", () => {
  it("uses the four defaults in order when the block is absent", () => {
    expect(resolveCertificationPathways(project()).map(({ id }) => id)).toEqual([
      "phi-classic",
      "phi-leb",
      "phius-core-2024",
      "phius-zero-2024",
    ]);
  });

  it("preserves show order and marks the recommendation", () => {
    const resolved = resolveCertificationPathways(
      project({ show: ["phius-core-2024", "enerphit-component"], recommended: "enerphit-component" }),
    );

    expect(resolved.map(({ id, recommended }) => ({ id, recommended }))).toEqual([
      { id: "phius-core-2024", recommended: false },
      { id: "enerphit-component", recommended: true },
    ]);
  });

  it("rejects an unknown ID and lists valid IDs", () => {
    expect(() => resolveCertificationPathways(project({ show: ["not-a-pathway"] }))).toThrow(
      /Unknown certification pathway ID "not-a-pathway"\. Valid IDs: .*phi-classic/,
    );
  });

  it("rejects a duplicate ID", () => {
    expect(() =>
      resolveCertificationPathways(project({ show: ["phi-classic", "phi-classic"] })),
    ).toThrow(/Duplicate certification pathway ID "phi-classic"/);
  });

  it("rejects a recommendation that is not shown", () => {
    expect(() =>
      resolveCertificationPathways(
        project({ show: ["phi-classic"], recommended: "enerphit-component" }),
      ),
    ).toThrow(/Recommended certification pathway ID "enerphit-component" is not included in show/);
  });

  it("rejects an unknown recommendation", () => {
    expect(() =>
      resolveCertificationPathways(
        project({ show: ["phi-classic"], recommended: "not-a-pathway" }),
      ),
    ).toThrow(/Unknown recommended certification pathway ID "not-a-pathway"/);
  });
});

describe("resolveCertificationPathwayRowValue", () => {
  const row: BoundCertificationPathwayRow = {
    label: "Heating Demand",
    key: "narrative.certification.enph_hd_limit",
    unit: "kBtu/sf-yr",
    fallback: "Set by climate zone in PHPP",
  };

  it("appends the catalog unit to a bound value", () => {
    const configuredProject = {
      narrative: { certification: { enph_hd_limit: "8.25" } },
    } as ProjectConfig;

    expect(resolveCertificationPathwayRowValue(configuredProject, row)).toBe("8.25 kBtu/sf-yr");
  });

  it("warns and renders fallback text for an absent value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const value = resolveCertificationPathwayRowValue(
      { narrative: { certification: {} } } as ProjectConfig,
      row,
    );
    resolveCertificationPathwayRowValue({ narrative: { certification: {} } } as ProjectConfig, row);

    expect(value).toBe("Set by climate zone in PHPP");
    expect(value).not.toContain("[MISSING");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(row.key));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
