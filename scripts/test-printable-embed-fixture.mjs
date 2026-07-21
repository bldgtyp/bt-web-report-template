#!/usr/bin/env node

import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { chromium } from "@playwright/test";
import { JSDOM, VirtualConsole } from "jsdom";
import { parse, stringify } from "yaml";

import { startDistServer } from "./dist-server.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = join(repoRoot, "tests", "fixtures", "printable-embed");
const runtimeRoot = await mkdtemp(join(tmpdir(), "btwr-printable-embed-"));
const keepRuntime = process.env.BTWR_KEEP_PRINTABLE_EMBED_FIXTURE === "1";

try {
  await prepareRuntime();
  run("pnpm", ["build"]);
  await assertBuiltRepresentations();
  await assertBrowserAndPagedRepresentations();

  run(process.execPath, ["scripts/build-pdf.mjs"]);
  await assertMissingAssetDiagnostic();

  console.log("[printable-embed-fixture] web, print, PDF, and missing-asset checks passed");
} finally {
  if (keepRuntime) {
    console.log(`[printable-embed-fixture] retained runtime: ${runtimeRoot}`);
  } else {
    await rm(runtimeRoot, { force: true, recursive: true });
  }
}

async function assertBrowserAndPagedRepresentations() {
  const distServer = await startDistServer(join(runtimeRoot, "dist"));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${distServer.baseUrl}/embed-fixture/`, { waitUntil: "networkidle" });
      assert.equal(await page.locator("[data-fixture-interactive]").count(), 1, `interactive child missing at ${width}px`);
      assert.equal(await page.locator("[data-btwr-printable-embed]").count(), 0, `print wrapper leaked at ${width}px`);
      const viewport = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      assert.ok(viewport.scrollWidth <= viewport.innerWidth, `web embed overflows at ${width}px`);
    }

    await page.goto(`${distServer.baseUrl}/print/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.pagedRendered === "true");
    assert.equal(await page.locator("[data-fixture-interactive]").count(), 0, "interactive child leaked into paged output");

    const printGeometry = await page.locator('[data-btwr-embed-id="comfort-bands"]').evaluate((embed) => {
      const pageElement = embed.closest(".pagedjs_page");
      const embedRect = embed.getBoundingClientRect();
      const pageRect = pageElement?.getBoundingClientRect();
      return {
        count: document.querySelectorAll('[data-btwr-embed-id="comfort-bands"]').length,
        fitsPage: Boolean(pageRect && embedRect.top >= pageRect.top && embedRect.bottom <= pageRect.bottom),
      };
    });
    assert.equal(printGeometry.count, 1, "paged output duplicated the print representation");
    assert.ok(printGeometry.fitsPage, "print representation split across paged output");
  } finally {
    await browser.close();
    await distServer.close();
  }
}

async function prepareRuntime() {
  const entries = [
    "astro.config.mjs",
    "content",
    "data",
    "package.json",
    "playwright.config.ts",
    "project.yaml",
    "public",
    "scripts",
    "src",
    "tina",
    "tsconfig.json",
    "vitest.config.ts",
  ];

  for (const entry of entries) {
    await cp(join(repoRoot, entry), join(runtimeRoot, entry), { recursive: true });
  }
  await symlink(join(repoRoot, "node_modules"), join(runtimeRoot, "node_modules"), "dir");

  const projectPath = join(runtimeRoot, "project.yaml");
  const project = parse(await readFile(projectPath, "utf8"));
  project.custom_pages = [{ slug: "embed-fixture", label: "Embed Fixture" }];
  await writeFile(projectPath, stringify(project));

  const contentDir = join(runtimeRoot, "content", "custom", "embed-fixture");
  const assetDir = join(runtimeRoot, "public", "assets", "printable-embed");
  await mkdir(contentDir, { recursive: true });
  await mkdir(assetDir, { recursive: true });
  await cp(join(fixtureRoot, "content.mdx"), join(contentDir, "overview.mdx"));
  await cp(join(fixtureRoot, "comfort-bands.svg"), join(assetDir, "comfort-bands.svg"));
}

async function assertBuiltRepresentations() {
  const web = parseBuiltHtml(await readFile(join(runtimeRoot, "dist", "embed-fixture", "index.html"), "utf8"));
  const print = parseBuiltHtml(await readFile(join(runtimeRoot, "dist", "print", "index.html"), "utf8"));

  assert.ok(web.window.document.querySelector('[data-btwr-embed-id="comfort-bands"]'), "web embed is missing");
  assert.ok(web.window.document.querySelector("[data-fixture-interactive]"), "interactive web child is missing");
  assert.ok(!web.window.document.querySelector("[data-btwr-printable-embed]"), "print wrapper leaked into web output");
  assert.ok(
    !web.window.document.querySelector('img[src="/assets/printable-embed/comfort-bands.svg"]'),
    "print asset leaked into web output",
  );

  const printEmbeds = print.window.document.querySelectorAll(
    '[data-btwr-page-id="embed-fixture"] [data-btwr-printable-embed][data-btwr-embed-id="comfort-bands"]',
  );
  assert.equal(printEmbeds.length, 1, "expected exactly one print representation");
  assert.ok(!print.window.document.querySelector("[data-fixture-interactive]"), "interactive child leaked into print output");

  const image = printEmbeds[0].querySelector("img");
  assert.equal(image?.getAttribute("src"), "/assets/printable-embed/comfort-bands.svg", "print asset URL drifted");
  assert.equal(image?.getAttribute("alt"), "Illustrative indoor comfort bands", "print asset alt text drifted");
  assert.equal(image?.getAttribute("width"), "1200", "intrinsic width drifted");
  assert.equal(image?.getAttribute("height"), "675", "intrinsic height drifted");
}

function parseBuiltHtml(html) {
  // JSDOM does not understand Paged.js nested @page rules. They are valid for
  // the real Chromium/Paged.js path exercised below, so suppress that parser's
  // expected stylesheet warning while inspecting markup.
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => {
    const isKnownPagedCssError =
      error.message === "Could not parse CSS stylesheet" && String(error.detail ?? "").includes("@page");
    if (!isKnownPagedCssError) {
      throw error;
    }
  });
  return new JSDOM(html, { virtualConsole });
}

async function assertMissingAssetDiagnostic() {
  const builtAsset = join(runtimeRoot, "dist", "assets", "printable-embed", "comfort-bands.svg");
  await unlink(builtAsset);
  const result = spawnSync(process.execPath, ["scripts/build-pdf.mjs"], {
    cwd: runtimeRoot,
    encoding: "utf8",
    env: process.env,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const expected =
    'Printable embed asset is missing or unreadable for custom page "embed-fixture", embed "comfort-bands": /assets/printable-embed/comfort-bands.svg';
  assert.notEqual(result.status, 0, "PDF build unexpectedly accepted a missing print asset");
  assert.ok(output.includes(expected), `missing-asset diagnostic drifted:\n${output}`);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: runtimeRoot,
    encoding: "utf8",
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${basename(command)} ${args.join(" ")} failed with exit code ${String(result.status)}`);
  }
}
