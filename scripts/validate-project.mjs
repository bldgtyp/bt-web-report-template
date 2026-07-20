#!/usr/bin/env node
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { readProjectFile, projectPathFromRoot } from "../src/data/project-schema.mjs";

// Which .mdx files a project ships is up to the project — the renderer globs
// each directory and renders what it finds. So this validates the two things
// that are still structurally required, not a section inventory.
//
// `summary.mdx` is a genuine hard dependency: the Summary page imports it
// statically and reads hero props off its frontmatter. `appendix.mdx` is
// orphaned (rendered by no page) but still required here, deliberately —
// dropping it is a separate cleanup decision, not part of making sections
// removable.
const REQUIRED_SECTION_FILES = ["content/summary.mdx", "content/appendix.mdx"];

// Each report page renders whatever it finds in its directory, but an empty
// directory means a failed scrape or a broken content symlink, so it is an
// error here as well as in the loader.
const REQUIRED_SECTION_DIRS = [
  "content/energy-model",
  "content/envelope",
  "content/windows",
  "content/mechanical",
];

const REQUIRED_PACKAGE_SCRIPTS = ["dev:editor", "build:editor", "check:editor"];

function requireFile(root, relativePath) {
  if (!fs.existsSync(new URL(relativePath, root))) {
    throw new Error(`missing required file: ${relativePath}`);
  }
}

function requireSectionsIn(root, relativeDir) {
  const dirUrl = new URL(`${relativeDir}/`, root);

  if (!fs.existsSync(dirUrl)) {
    throw new Error(`missing required directory: ${relativeDir}`);
  }

  // Non-recursive on purpose: `envelope/assemblies/` and `mechanical/plans/`
  // are card directories, not sections.
  const sections = fs
    .readdirSync(dirUrl, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"));

  if (sections.length === 0) {
    throw new Error(
      `no .mdx sections found in ${relativeDir} — expected at least one; ` +
        "an empty content directory usually means a failed scrape or a broken content symlink.",
    );
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

export function validateCustomPageContent(root, customPages = []) {
  const customRoot = new URL("content/custom/", root);
  const registered = new Set(customPages.map(({ slug }) => slug));
  const discovered = new Set();

  if (fs.existsSync(customRoot)) {
    for (const entry of fs.readdirSync(customRoot, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".mdx")) {
        throw new Error(`custom page MDX must be inside a slug directory: content/custom/${entry.name}`);
      }
      if (entry.isDirectory()) {
        discovered.add(entry.name);
      }
    }
  }

  for (const slug of discovered) {
    if (!registered.has(slug)) {
      throw new Error(`unregistered custom page content directory: content/custom/${slug}`);
    }
  }

  for (const slug of registered) {
    const relativeDir = `content/custom/${slug}`;
    const pageDir = new URL(`${slug}/`, customRoot);
    let entries;
    try {
      entries = fs.readdirSync(pageDir, { withFileTypes: true });
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
      throw new Error(`registered custom page "${slug}" is missing content directory: ${relativeDir}`);
    }

    const nestedMdx = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => findFirstMdx(new URL(`${entry.name}/`, pageDir), `${relativeDir}/${entry.name}`))
      .find(Boolean);
    if (nestedMdx) {
      throw new Error(`nested custom page MDX is not supported: ${nestedMdx}`);
    }

    const sections = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"));
    if (sections.length === 0) {
      throw new Error(`no top-level .mdx sections found in ${relativeDir}`);
    }
  }
}

function findFirstMdx(directory, relativeDir) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      const nestedMdx = findFirstMdx(new URL(`${entry.name}/`, directory), relativePath);
      if (nestedMdx) {
        return nestedMdx;
      }
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      return relativePath;
    }
  }
  return undefined;
}

export async function validateProjectRoot(rootPath = process.cwd()) {
  const root = pathToFileURL(`${rootPath}/`);
  const project = await readProjectFile(projectPathFromRoot(rootPath));
  for (const sectionFile of REQUIRED_SECTION_FILES) {
    requireFile(root, sectionFile);
  }
  for (const sectionDir of REQUIRED_SECTION_DIRS) {
    requireSectionsIn(root, sectionDir);
  }
  validateCustomPageContent(root, project.custom_pages ?? []);
  requireFile(root, "tina/config.ts");
  requirePackageScripts(root);
  return project;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const project = await validateProjectRoot();
    console.log(`project.yaml ok: ${project.slug} (${project.project_title})`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
