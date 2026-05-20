#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { readProjectFile, projectPathFromRoot } from "../src/data/project-schema.mjs";

const REQUIRED_SECTION_FILES = [
  "content/summary.mdx",
  "content/energy-model/model-geometry.mdx",
  "content/energy-model/model-variants.mdx",
  "content/energy-model/site-energy.mdx",
  "content/energy-model/co2-emissions.mdx",
  "content/energy-model/passive-house-thresholds.mdx",
  "content/energy-model/climate-data.mdx",
  "content/energy-model/passive-house-certifications.mdx",
  "content/envelope/assemblies.mdx",
  "content/envelope/airtightness.mdx",
  "content/envelope/aerobarrier.mdx",
  "content/windows/window-thermal-comfort.mdx",
  "content/windows/site-shading.mdx",
  "content/windows/winter-radiation.mdx",
  "content/windows/summer-radiation.mdx",
  "content/mechanical/fresh-air-ventilation.mdx",
  "content/mechanical/fresh-air-flow-rates.mdx",
  "content/mechanical/ventilation-system-balancing.mdx",
  "content/mechanical/passive-house-ventilation-requirements.mdx",
  "content/mechanical/appliances-and-venting.mdx",
  "content/mechanical/building-monitoring.mdx",
  "content/appendix.mdx",
];

const REQUIRED_PACKAGE_SCRIPTS = ["dev:editor", "build:editor", "check:editor"];

function requireFile(root, relativePath) {
  if (!fs.existsSync(new URL(relativePath, root))) {
    throw new Error(`missing required file: ${relativePath}`);
  }
}

function requirePackageScripts(root) {
  const packageJsonUrl = new URL("package.json", root);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonUrl, "utf8"));
  for (const scriptName of REQUIRED_PACKAGE_SCRIPTS) {
    if (typeof packageJson.scripts?.[scriptName] !== "string") {
      throw new Error(`missing package.json script: ${scriptName}`);
    }
  }
}

try {
  const root = pathToFileURL(`${process.cwd()}/`);
  const project = await readProjectFile(projectPathFromRoot(process.cwd()));
  for (const sectionFile of REQUIRED_SECTION_FILES) {
    requireFile(root, sectionFile);
  }
  requireFile(root, "tina/config.ts");
  requirePackageScripts(root);
  console.log(`project.yaml ok: ${project.slug} (${project.project_title})`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
