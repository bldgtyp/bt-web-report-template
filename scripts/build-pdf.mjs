#!/usr/bin/env node
// Builds dist/report.pdf from the rendered /print route via Paged.js +
// headless Chromium + pdf-lib for metadata.

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { chromium } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { projectPathFromRoot, readProjectFile } from "../src/data/project-schema.mjs";
import { startDistServer } from "./dist-server.mjs";

const PAGED_READY_TIMEOUT_MS = 120_000;
const NETWORK_IDLE_TIMEOUT_MS = 60_000;

const root = process.cwd();
const distDir = resolve(root, "dist");
const printIndexPath = join(distDir, "print", "index.html");
const indexPath = join(distDir, "index.html");
const outputPath = join(distDir, "report.pdf");

if (!existsSync(indexPath) || !existsSync(printIndexPath)) {
  throw new Error("dist/ is missing index.html or print/index.html. Run `pnpm build` first.");
}

await mkdir(distDir, { recursive: true });

const [distServer, browser] = await Promise.all([startDistServer(distDir), chromium.launch()]);
const printUrl = `${distServer.baseUrl}/print/`;

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("pageerror", (error) => {
    console.error(`[build-pdf] page error: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(`[build-pdf] console error: ${message.text()}`);
    }
  });

  console.log(`[build-pdf] navigating to ${printUrl}`);
  await page.goto(printUrl, { waitUntil: "networkidle", timeout: NETWORK_IDLE_TIMEOUT_MS });

  console.log(`[build-pdf] waiting for paged.js (up to ${PAGED_READY_TIMEOUT_MS / 1000}s)`);
  await page.waitForFunction(
    () => {
      const flag = document.documentElement.getAttribute("data-paged-rendered");
      return flag === "true" || flag === "error" || flag === "skipped";
    },
    null,
    { timeout: PAGED_READY_TIMEOUT_MS },
  );

  const { pagedState, pagedError } = await page.evaluate(() => ({
    pagedState: document.documentElement.getAttribute("data-paged-rendered"),
    pagedError: document.documentElement.getAttribute("data-paged-error"),
  }));
  if (pagedState !== "true") {
    throw new Error(
      `Paged.js did not complete cleanly (state=${pagedState}). ` +
        (pagedError || "See preceding [build-pdf] page/console error logs."),
    );
  }

  const pagedPageCount = await page.evaluate(() => document.querySelectorAll(".pagedjs_page").length);
  console.log(`[build-pdf] paged.js produced ${pagedPageCount} pages`);

  await page.emulateMedia({ media: "print" });

  console.log(`[build-pdf] capturing PDF`);
  const rawPdf = await page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: false,
    timeout: 0,
  });

  console.log(`[build-pdf] writing metadata`);
  const finalPdf = await applyPdfMetadata(rawPdf);
  await writeFile(outputPath, finalPdf);

  console.log(`[build-pdf] wrote ${outputPath}`);
} finally {
  await browser.close();
  await distServer.close();
}

async function applyPdfMetadata(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const project = await readProjectFile(projectPathFromRoot(root));

  const title = project.project_title
    ? `${project.project_title} — ${project.phase || "Report"}`
    : "BLDGTYP Report";
  const author = project.prepared_by || "BLDGTYP, LLC";
  const subjectBits = [
    project.client_name && `Prepared for ${project.client_name}`,
    project.building_name,
    project.phase,
  ].filter(Boolean);
  const subject = subjectBits.length > 0 ? subjectBits.join(" · ") : "Passive House design report";
  const keywords = [
    "passive house",
    "energy model",
    "report",
    project.target_standard,
    project.certification_program,
    project.slug,
  ].filter(Boolean);

  pdfDoc.setTitle(title);
  pdfDoc.setAuthor(author);
  pdfDoc.setSubject(subject);
  pdfDoc.setKeywords(keywords);
  pdfDoc.setCreator("bt-web-report-template");
  if (project.report_date) {
    const reportDate = new Date(project.report_date);
    if (!Number.isNaN(reportDate.getTime())) {
      pdfDoc.setCreationDate(reportDate);
      pdfDoc.setModificationDate(reportDate);
    }
  }

  return pdfDoc.save();
}
