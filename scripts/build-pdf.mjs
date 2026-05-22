#!/usr/bin/env node
// Builds dist/report.pdf from the rendered /print route via Paged.js +
// headless Chromium + pdf-lib for metadata.

import { createReadStream, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

import { chromium } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

import { projectPathFromRoot, readProjectFile } from "../src/data/project-schema.mjs";

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

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  let pathname = requestUrl.pathname;
  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }
  const filePath = resolve(distDir, `.${pathname}`);

  if (!filePath.startsWith(distDir) || !existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.setHeader("Content-Type", contentType(filePath));
  createReadStream(filePath).pipe(response);
});

const [, browser] = await Promise.all([
  new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen)),
  chromium.launch(),
]);

const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;
const printUrl = `http://127.0.0.1:${port}/print/`;

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

  const pagedState = await page.evaluate(() =>
    document.documentElement.getAttribute("data-paged-rendered"),
  );
  if (pagedState !== "true") {
    throw new Error(
      `Paged.js did not complete cleanly (state=${pagedState}). ` +
        "See preceding [build-pdf] page/console error logs.",
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
  await new Promise((resolveClose) => server.close(resolveClose));
}

function contentType(filePath) {
  switch (extname(filePath)) {
    case ".css":
      return "text/css";
    case ".js":
    case ".mjs":
      return "text/javascript";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".woff2":
      return "font/woff2";
    case ".woff":
      return "font/woff";
    case ".json":
      return "application/json";
    case ".html":
    default:
      return "text/html";
  }
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
