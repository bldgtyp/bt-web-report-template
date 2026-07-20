import { readdir, readFile } from "node:fs/promises";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

// The seed content has to satisfy the same rules `loadSections` enforces at
// build time. These run against the real .mdx files, so a duplicate or missing
// kicker introduced while editing seed prose fails here rather than in a
// project's build.

const SECTION_DIRS = ["energy-model", "envelope", "windows", "mechanical"];

function frontmatterFor(source: string): Record<string, unknown> {
  const match = source.match(/^---\n([\s\S]*?)\n---/);

  if (!match) {
    throw new Error("missing MDX frontmatter");
  }

  return parse(match[1]);
}

async function sectionsIn(dir: string) {
  const dirUrl = new URL(`../content/${dir}/`, import.meta.url);
  const filenames = (await readdir(dirUrl, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => entry.name);

  return Promise.all(
    filenames.map(async (filename) => ({
      filename,
      frontmatter: frontmatterFor(await readFile(new URL(filename, dirUrl), "utf8")),
    })),
  );
}

describe("seed section content", () => {
  it.each(SECTION_DIRS)("content/%s holds at least one section", async (dir) => {
    expect((await sectionsIn(dir)).length).toBeGreaterThan(0);
  });

  it.each(SECTION_DIRS)("content/%s gives every section a kicker and title", async (dir) => {
    for (const { filename, frontmatter } of await sectionsIn(dir)) {
      expect(frontmatter, `${dir}/${filename}`).toMatchObject({
        kicker: expect.any(String),
        title: expect.any(String),
      });
    }
  });

  it.each(SECTION_DIRS)("content/%s keeps kickers unique", async (dir) => {
    const kickers = (await sectionsIn(dir)).map((section) => section.frontmatter.kicker);

    expect(new Set(kickers).size, `duplicate kicker in content/${dir}: ${kickers.join(", ")}`).toBe(kickers.length);
  });

  it.each(SECTION_DIRS)("content/%s resolves to unique section ids", async (dir) => {
    const ids = (await sectionsIn(dir)).map(
      (section) => (section.frontmatter.section_id as string | undefined) ?? section.filename.replace(/\.mdx$/, ""),
    );

    expect(new Set(ids).size, `duplicate section id in content/${dir}: ${ids.join(", ")}`).toBe(ids.length);
  });
});
