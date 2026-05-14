#!/usr/bin/env node
import assert from "node:assert/strict";

import { parseProjectYaml } from "../src/data/project-schema.mjs";

const baseProject = {
  schema_version: "0.1.0",
  slug: "project-2606",
  project_title: "29 Vandam",
  client_name: "Yun Architects",
  building_name: "TBD",
  phase: "Design Analysis",
  report_date: "2026-05-14",
  prepared_by: "BLDGTYP",
  contact_email: "info@bldgtyp.com",
  target_standard: "Passive House",
  certification_program: "Design analysis only",
  certification_path: "Not submitted",
  building: {
    address: "TBD",
    city: "Brooklyn",
    state: "NY",
    climate_zone: "ASHRAE 4A",
    building_type: "single-family residential",
  },
  source_files: {
    phpp_path: "../07_PHPP/model.xlsx",
    data_dir: "data",
    assets_dir: "public/assets",
  },
  publishing: {
    production_url: "https://project-2606.bldgtyp.com",
    cloudflare_pages_project: "bt-proj-project-2606",
  },
};

function toYaml(project) {
  return JSON.stringify(project);
}

assert.equal(parseProjectYaml(toYaml(baseProject), "project.yaml").slug, "project-2606");
assert.equal(parseProjectYaml(toYaml({ ...baseProject, slug: "2606-vandam" }), "project.yaml").slug, "2606-vandam");

for (const slug of ["Project-2606", "project_2606", "project--2606", "-project-2606", "project-2606-"]) {
  assert.throws(
    () => parseProjectYaml(toYaml({ ...baseProject, slug }), "project.yaml"),
    /slug must be lowercase kebab-case/,
  );
}

console.log("project-schema slug validation ok");
