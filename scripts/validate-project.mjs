#!/usr/bin/env node
import { readProjectFile, projectPathFromRoot } from "../src/data/project-schema.mjs";

try {
  const project = await readProjectFile(projectPathFromRoot(process.cwd()));
  console.log(`project.yaml ok: ${project.slug} (${project.project_title})`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
