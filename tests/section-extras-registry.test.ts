import { describe, expect, it } from "vitest";

import {
  resolveSectionExtras,
  type SectionExtrasRegistry,
} from "../src/data/section-extras-registry";
import type { SectionEntry } from "../src/data/sections";

const Before = () => null;
const Chart = () => null;
const Table = () => null;

const registry: SectionExtrasRegistry = {
  Before: { component: Before, slot: "Before" },
  Chart: { component: Chart, slot: "Children" },
  Table: { component: Table, slot: "Children" },
};

function section(extras: unknown): SectionEntry {
  return {
    id: "resilience-summer",
    kicker: "02",
    title: "Summer",
    sourcePath: "../../content/custom/resilience/summer.mdx",
    frontmatter: { kicker: "02", title: "Summer", extras },
    Content: () => null,
  };
}

describe("resolveSectionExtras", () => {
  it("resolves one component per supported slot", () => {
    expect(resolveSectionExtras([section(["Before", "Chart"])], registry)).toEqual({
      "resilience-summer": { Before, Children: Chart },
    });
  });

  it.each(["Chart", ["Chart", 42]])("rejects a non-string-list value", (extras) => {
    expect(() => resolveSectionExtras([section(extras)], registry)).toThrow(
      /summer.mdx: "extras" must be a list of component names/,
    );
  });

  it("rejects duplicate names", () => {
    expect(() => resolveSectionExtras([section(["Chart", "Chart"])], registry)).toThrow(
      /summer.mdx: duplicate extra "Chart"/,
    );
  });

  it("rejects unknown names and lists valid choices", () => {
    expect(() => resolveSectionExtras([section(["Unknown"])], registry)).toThrow(
      /unknown extra "Unknown"\. Valid names: Before, Chart, Table/,
    );
  });

  it("rejects two names registered to the same slot", () => {
    expect(() => resolveSectionExtras([section(["Chart", "Table"])], registry)).toThrow(
      /extras "Chart" and "Table" both use the Children slot/,
    );
  });
});
