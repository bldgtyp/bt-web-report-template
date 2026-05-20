import { join } from "node:path";

import { projectPathFromRoot, readProjectFile } from "./project-schema.mjs";

export interface CertificationNarrative {
  target?: string | null;
  ph_ach_limit?: string | null;
  phi_lcd_limit?: string | null;
  enph_hd_limit?: string | null;
  enph_per_limit?: string | null;
  enph_bg_limit?: string | null;
  enph_ag_ext_limit?: string | null;
  enph_ag_int_limit?: string | null;
  enph_uw_limit?: string | null;
  phius_hd_limit?: string | null;
  phius_cd_limit?: string | null;
  phius_hl_limit?: string | null;
  phius_cl_limit?: string | null;
  phius_nse_limit?: string | null;
  phius_cfm50_limit?: string | null;
}

export interface ClimateNarrative {
  weather_station_name?: string | null;
  weather_station_url?: string | null;
  state_name?: string | null;
  state_name_abbreviation?: string | null;
  ashrae_location_name?: string | null;
  ashrae_design_temps?: string | null;
}

export interface EnergyCodeNarrative {
  name?: string | null;
  zone?: string | null;
  link?: string | null;
  u_val_link?: string | null;
  ach_link?: string | null;
  ach_limit?: string | null;
  window_min_u_value?: string | null;
}

export interface Co2Narrative {
  subregion_name?: string | null;
  occupancy?: string | null;
  target_tons?: string | null;
}

export interface WindowsNarrative {
  ph_window_u_value?: string | null;
  ph_window_r_value?: string | null;
}

export interface ErvNarrative {
  manufacturer_name?: string | null;
  type_name?: string | null;
  link?: string | null;
}

export interface MechanicalNarrative {
  erv: ErvNarrative;
}

export interface Narrative {
  certification: CertificationNarrative;
  climate: ClimateNarrative;
  energy_code: EnergyCodeNarrative;
  co2: Co2Narrative;
  windows: WindowsNarrative;
  mechanical: MechanicalNarrative;
}

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
  narrative: Narrative;
}

export async function loadProjectConfig(root = process.cwd()): Promise<ProjectConfig> {
  // readProjectFile validates against the JSON Schema generated from the
  // Pydantic Project model; the shape is guaranteed to match ProjectConfig.
  return (await readProjectFile(projectPathFromRoot(root))) as unknown as ProjectConfig;
}

export function projectDataDir(project: ProjectConfig, root = process.cwd()): string {
  return join(root, process.env.BTWR_DATA_DIR || project.source_files.data_dir || "data");
}

export function manifestProject(project: ProjectConfig): { slug: string; name: string } {
  return {
    slug: project.slug,
    name: project.project_title,
  };
}
