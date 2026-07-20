import { describe, expect, it } from "vitest";

import { loadSections, sectionProps, tocItemsFromSections, type SectionModule } from "../src/data/sections";

function sectionModule(frontmatter: Record<string, unknown>): SectionModule {
  return {
    default: () => null,
    frontmatter: frontmatter as SectionModule["frontmatter"],
  };
}

describe("loadSections", () => {
  it("orders by kicker regardless of glob key order", () => {
    const sections = loadSections({
      "../../content/envelope/aerobarrier.mdx": sectionModule({ kicker: "04", title: "AeroBarrier" }),
      "../../content/envelope/assemblies.mdx": sectionModule({ kicker: "01", title: "Assemblies" }),
      "../../content/envelope/primer.mdx": sectionModule({ kicker: "03", title: "Primer" }),
    });

    expect(sections.map((section) => section.id)).toEqual(["assemblies", "primer", "aerobarrier"]);
  });

  it("derives the id from the filename and honors a section_id override", () => {
    const sections = loadSections({
      "../../content/envelope/assemblies.mdx": sectionModule({
        kicker: "01",
        title: "Recommended Assemblies",
        section_id: "recommended-assemblies",
      }),
      "../../content/envelope/aerobarrier.mdx": sectionModule({ kicker: "02", title: "AeroBarrier" }),
    });

    expect(sections.map((section) => section.id)).toEqual(["recommended-assemblies", "aerobarrier"]);
  });

  it("rejects an empty content directory", () => {
    expect(() => loadSections({})).toThrow(/No section .mdx files found/);
  });

  it("rejects a section missing its kicker", () => {
    expect(() =>
      loadSections({ "../../content/envelope/aerobarrier.mdx": sectionModule({ title: "AeroBarrier" }) }),
    ).toThrow(/aerobarrier.mdx" is missing the required "kicker"/);
  });

  it("rejects duplicate section ids", () => {
    expect(() =>
      loadSections({
        "../../content/envelope/assemblies.mdx": sectionModule({ kicker: "01", title: "A" }),
        "../../content/envelope/aerobarrier.mdx": sectionModule({
          kicker: "02",
          title: "B",
          section_id: "assemblies",
        }),
      }),
    ).toThrow(/Duplicate section id "assemblies"/);
  });

  it("rejects duplicate kickers, which would mask a numbering mistake", () => {
    expect(() =>
      loadSections({
        "../../content/envelope/assemblies.mdx": sectionModule({ kicker: "01", title: "A" }),
        "../../content/envelope/aerobarrier.mdx": sectionModule({ kicker: "01", title: "B" }),
      }),
    ).toThrow(/Duplicate kicker "01"/);
  });
});

describe("tocItemsFromSections", () => {
  it("mirrors the loaded sections in order", () => {
    const sections = loadSections({
      "../../content/envelope/assemblies.mdx": sectionModule({
        kicker: "01",
        title: "Recommended Assemblies",
        section_id: "recommended-assemblies",
      }),
      "../../content/envelope/aerobarrier.mdx": sectionModule({ kicker: "02", title: "AeroBarrier" }),
    });

    expect(tocItemsFromSections(sections)).toEqual([
      { href: "#recommended-assemblies", label: "Recommended Assemblies", number: "01" },
      { href: "#aerobarrier", label: "AeroBarrier", number: "02" },
    ]);
  });
});

describe("sectionProps", () => {
  it("passes callout frontmatter through to <ReportSection>", () => {
    const [section] = loadSections({
      "../../content/envelope/assemblies.mdx": sectionModule({
        kicker: "01",
        title: "Recommended Assemblies",
        callout_label: "Structural coordination",
        callout_body: "Sizing by others.",
        dek: "ignored by the section props",
      }),
    });

    expect(sectionProps(section)).toMatchObject({
      id: "assemblies",
      kicker: "01",
      title: "Recommended Assemblies",
      callout_label: "Structural coordination",
      callout_body: "Sizing by others.",
    });
  });
});
