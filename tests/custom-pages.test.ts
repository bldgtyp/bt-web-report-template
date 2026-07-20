import { describe, expect, it } from "vitest";

import {
  assertCustomPageRegistrationMatchesModules,
  groupCustomPageModules,
  loadCustomPageSectionsFromModules,
} from "../src/data/custom-pages";
import type { SectionModule } from "../src/data/sections";

function sectionModule(kicker: string, title: string, section_id?: string): SectionModule {
  return {
    default: () => null,
    frontmatter: { kicker, title, section_id },
  };
}

describe("custom page section loading", () => {
  const modules = {
    "../../content/custom/resilience/winter.mdx": sectionModule("03", "Winter", "winter-set"),
    "../../content/custom/resilience/assessment.mdx": sectionModule("01", "Assessment"),
    "../../content/custom/resilience/summer.mdx": sectionModule("02", "Summer"),
    "../../content/custom/durability/overview.mdx": sectionModule("01", "Overview"),
  };

  it("groups only by the immediate custom-page slug", () => {
    const groups = groupCustomPageModules(modules);

    expect(Object.keys(groups).sort()).toEqual(["durability", "resilience"]);
    expect(Object.keys(groups.resilience)).toHaveLength(3);
  });

  it("sorts through loadSections and prefixes every custom section id", () => {
    const sections = loadCustomPageSectionsFromModules("resilience", groupCustomPageModules(modules).resilience);

    expect(sections.map(({ id }) => id)).toEqual([
      "resilience-assessment",
      "resilience-summer",
      "resilience-winter-set",
    ]);
    expect(sections[0].sourcePath).toContain("content/custom/resilience/assessment.mdx");
  });

  it("rejects module paths outside the non-recursive contract", () => {
    expect(() =>
      groupCustomPageModules({
        "../../content/custom/resilience/nested/assessment.mdx": sectionModule("01", "Assessment"),
      }),
    ).toThrow(/does not match content\/custom/);
  });

  it("requires registered slugs and discovered module groups to match", () => {
    expect(() =>
      assertCustomPageRegistrationMatchesModules([{ slug: "resilience", label: "Resilience" }], {
        "../../content/custom/durability/overview.mdx": sectionModule("01", "Overview"),
      }),
    ).toThrow(/Registered custom page "resilience" has no content modules/);

    expect(() =>
      assertCustomPageRegistrationMatchesModules([{ slug: "resilience", label: "Resilience" }], modules),
    ).toThrow(/content for "durability" is not registered/);
  });
});
