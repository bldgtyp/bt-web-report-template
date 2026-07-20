import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { validateCustomPageContent } from "../scripts/validate-project.mjs";

const roots: string[] = [];

function rootUrl(): URL {
  const root = mkdtempSync(join(tmpdir(), "btwr-custom-pages-"));
  roots.push(root);
  return pathToFileURL(`${root}/`);
}

function addFile(root: URL, relativePath: string): void {
  const path = join(root.pathname, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "---\nkicker: '01'\ntitle: Test\n---\n");
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("validateCustomPageContent", () => {
  it("allows content/custom to be absent when nothing is registered", () => {
    expect(() => validateCustomPageContent(rootUrl(), [])).not.toThrow();
  });

  it("accepts a registered page with top-level MDX", () => {
    const root = rootUrl();
    addFile(root, "content/custom/resilience/assessment.mdx");

    expect(() =>
      validateCustomPageContent(root, [{ slug: "resilience", label: "Resilience" }]),
    ).not.toThrow();
  });

  it("rejects a registered page whose directory is missing", () => {
    expect(() =>
      validateCustomPageContent(rootUrl(), [{ slug: "resilience", label: "Resilience" }]),
    ).toThrow(/registered custom page "resilience" is missing content directory/);
  });

  it("rejects an empty registered page directory", () => {
    const root = rootUrl();
    mkdirSync(join(root.pathname, "content/custom/resilience"), { recursive: true });

    expect(() =>
      validateCustomPageContent(root, [{ slug: "resilience", label: "Resilience" }]),
    ).toThrow(/no top-level .mdx sections found in content\/custom\/resilience/);
  });

  it("rejects an orphan custom content directory", () => {
    const root = rootUrl();
    addFile(root, "content/custom/resilience/assessment.mdx");

    expect(() => validateCustomPageContent(root, [])).toThrow(
      /unregistered custom page content directory: content\/custom\/resilience/,
    );
  });

  it("rejects nested custom-page MDX", () => {
    const root = rootUrl();
    addFile(root, "content/custom/resilience/assessment.mdx");
    addFile(root, "content/custom/resilience/nested/details.mdx");

    expect(() =>
      validateCustomPageContent(root, [{ slug: "resilience", label: "Resilience" }]),
    ).toThrow(/nested custom page MDX is not supported: content\/custom\/resilience\/nested\/details.mdx/);
  });
});
