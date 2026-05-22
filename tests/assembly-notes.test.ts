import { readdir, readFile } from "node:fs/promises";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { normalizeAssemblyNotes } from "../src/content/assembly-notes";

function frontmatterFor(source: string): string {
  const match = source.match(/^---\n([\s\S]*?)\n---/);

  if (!match) {
    throw new Error("missing MDX frontmatter");
  }

  return match[1];
}

describe("assembly notes", () => {
  it("normalizes editor text without rejecting literal quotes", () => {
    expect(
      normalizeAssemblyNotes([
        ' Target.  6&quot; sub-slab ( Neopor Graphite EPS or sim. ). ',
        "Use 2\u2033 staggered layers.",
        "",
      ]),
    ).toEqual(['Target. 6" sub-slab (Neopor Graphite EPS or sim.).', 'Use 2" staggered layers.']);
  });

  it("keeps all assembly frontmatter parseable", async () => {
    const assemblyDir = new URL("../content/envelope/assemblies/", import.meta.url);
    const filenames = (await readdir(assemblyDir)).filter((filename) => filename.endsWith(".mdx"));

    for (const filename of filenames) {
      const source = await readFile(new URL(filename, assemblyDir), "utf8");
      const frontmatter = parse(frontmatterFor(source));

      expect(frontmatter).toMatchObject({
        title: expect.any(String),
      });
      expect(frontmatter.notes).toBeUndefined();
    }
  });

  it("keeps inch marks in assembly body text instead of YAML frontmatter", async () => {
    const source = await readFile(new URL("../content/envelope/assemblies/floor.mdx", import.meta.url), "utf8");
  const frontmatter = parse(frontmatterFor(source));

  expect(frontmatter.notes).toBeUndefined();
  expect(source).toContain('- Target. 6" sub-slab (');
  expect(source).toContain("Neopor Graphite EPS");
  });
});
