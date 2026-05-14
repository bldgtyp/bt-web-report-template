#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { readProjectFile, projectPathFromRoot } from "../src/data/project-schema.mjs";

const REQUIRED_SECTION_FILES = [
  "content/summary.mdx",
  "content/energy-model.mdx",
  "content/envelope/overview.mdx",
  "content/envelope/assemblies.mdx",
  "content/windows.mdx",
  "content/mechanical.mdx",
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
