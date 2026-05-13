import { join } from "node:path";

import { projectPathFromRoot, readProjectFile } from "./project-schema.mjs";

export interface ProjectConfig {
  schema_version: string;
  slug: string;
  project_title: string;
  client_name: string;
  building_name: string;
  phase: string;
  report_date: string;
  prepared_by: string;
  contact_email: string;
  target_standard: string;
  certification_program: string;
  certification_path: string;
  building: {
    address: string;
    city: string;
    state: string;
    climate_zone: string;
    building_type: string;
  };
  source_files: {
    phpp_path: string;
    data_dir: string;
    assets_dir: string;
  };
  publishing: {
    production_url: string;
    cloudflare_pages_project: string;
  };
}

export async function loadProjectConfig(root = process.cwd()): Promise<ProjectConfig> {
  return readProjectFile(projectPathFromRoot(root)) as Promise<ProjectConfig>;
}

export function projectDataDir(project: ProjectConfig, root = process.cwd()): string {
  return join(root, project.source_files.data_dir || "data");
}

export function manifestProject(project: ProjectConfig): { slug: string; name: string } {
  return {
    slug: project.slug,
    name: project.project_title,
  };
}
