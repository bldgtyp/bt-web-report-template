// Asserts structural + metadata properties of a previously-built
// dist/report.pdf. CI invokes the PDF build upstream of this suite;
// run `pnpm build:pdf` (or `pnpm build:pdf:fixture`) locally first.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PDFDocument } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "..");
const pdfPath = resolve(repoRoot, "dist", "report.pdf");

const LETTER_WIDTH_PTS = 612;
const LETTER_HEIGHT_PTS = 792;
const MIN_PAGES = 20;
const MAX_PAGES = 80;
const MIN_BYTES = 200_000;
const LETTER_TOLERANCE_PTS = 1;

describe("report.pdf", () => {
  let pdfDoc: PDFDocument;

  beforeAll(async () => {
    if (!existsSync(pdfPath)) {
      throw new Error(
        "dist/report.pdf is missing. Run `pnpm build:pdf` (or " +
          "`pnpm build:pdf:fixture` against the Vandam scrape) first.",
      );
    }
    pdfDoc = await PDFDocument.load(readFileSync(pdfPath));
  });

  it("exists and is non-trivially sized", () => {
    expect(statSync(pdfPath).size).toBeGreaterThan(MIN_BYTES);
  });

  it("contains a sensible number of pages", () => {
    const count = pdfDoc.getPageCount();
    expect(count).toBeGreaterThanOrEqual(MIN_PAGES);
    expect(count).toBeLessThanOrEqual(MAX_PAGES);
  });

  it("uses Letter page geometry on every page", () => {
    const offending = Array.from({ length: pdfDoc.getPageCount() }, (_, i) => {
      const { width, height } = pdfDoc.getPage(i).getSize();
      return { i, width, height };
    }).filter(
      ({ width, height }) =>
        Math.abs(width - LETTER_WIDTH_PTS) > LETTER_TOLERANCE_PTS ||
        Math.abs(height - LETTER_HEIGHT_PTS) > LETTER_TOLERANCE_PTS,
    );
    expect(offending).toEqual([]);
  });

  it("has a populated Title that names the project and phase", () => {
    const title = pdfDoc.getTitle() ?? "";
    expect(title).toMatch(/—/);
    const [left, right] = title.split("—").map((part) => part.trim());
    expect(left.length).toBeGreaterThan(0);
    expect(right?.length ?? 0).toBeGreaterThan(0);
  });

  it("has an Author set from project.yaml prepared_by", () => {
    expect((pdfDoc.getAuthor() ?? "").length).toBeGreaterThan(0);
  });

  it("has a Subject describing the client + building + phase", () => {
    expect((pdfDoc.getSubject() ?? "").length).toBeGreaterThan(0);
  });

  it("has Keywords for indexability", () => {
    expect(pdfDoc.getKeywords() ?? "").toMatch(/passive house/i);
  });

  it("has a Creator that identifies bt-web-report-template", () => {
    expect(pdfDoc.getCreator() ?? "").toContain("bt-web-report-template");
  });
});
