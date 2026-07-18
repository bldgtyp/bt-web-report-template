#!/usr/bin/env node
// Sanity test for project-schema.mjs (which delegates to ajv against the
// JSON Schema generated from bt-web-report-schemas). Adding cases here is
// fine; the comprehensive coverage lives in
// bt-web-report-schemas/tests/test_project_schema.py.

import assert from "node:assert/strict";

import { parseProjectYaml } from "../src/data/project-schema.mjs";

const baseProject = {
  schema_version: "0.2.0",
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
  recommended_variant_id: "improved",
  building: {
    address: "TBD",
    city: "Brooklyn",
    state: "NY",
    climate_zone: "ASHRAE 4A",
    building_type: "single-family residential",
    total_num_occupants: 4,
  },
  source_files: {
    phpp_path: "../07_PHPP/model.xlsx",
    data_dir: "data",
    assets_dir: "public/assets",
  },
  publishing: {
    production_url: "https://project-2606.bldgtyp.com",
    cloudflare_pages_project: "bt-proj-2606-vandam",
  },
};

function toYaml(project) {
  return JSON.stringify(project);
}

// Happy path: minimum required payload validates and round-trips slug.
assert.equal(parseProjectYaml(toYaml(baseProject), "project.yaml").slug, "project-2606");
assert.equal(parseProjectYaml(toYaml(baseProject), "project.yaml").building.total_num_occupants, 4);
assert.equal(parseProjectYaml(toYaml(baseProject), "project.yaml").publishing.access, undefined);
assert.equal(
  parseProjectYaml(toYaml({ ...baseProject, slug: "2606-vandam" }), "project.yaml").slug,
  "2606-vandam",
);

// Happy path: optional publishing.access accepts public and Cloudflare OTP configs.
const withPublicAccess = parseProjectYaml(
  toYaml({
    ...baseProject,
    publishing: {
      ...baseProject.publishing,
      access: { mode: "public", allowed_emails: [] },
    },
  }),
  "project.yaml",
);
assert.equal(withPublicAccess.publishing.access.mode, "public");
assert.deepEqual(withPublicAccess.publishing.access.allowed_emails, []);

const withOtpAccess = parseProjectYaml(
  toYaml({
    ...baseProject,
    publishing: {
      ...baseProject.publishing,
      access: {
        mode: "cloudflare_access_otp",
        allowed_emails: ["ed@bldgtyp.com", "john@bldgtyp.com"],
      },
    },
  }),
  "project.yaml",
);
assert.equal(withOtpAccess.publishing.access.mode, "cloudflare_access_otp");
assert.deepEqual(withOtpAccess.publishing.access.allowed_emails, ["ed@bldgtyp.com", "john@bldgtyp.com"]);

// Happy path: optional narrative round-trips through ajv.
const withNarrative = parseProjectYaml(
  toYaml({
    ...baseProject,
    narrative: {
      certification: { target: "EnerPHit by Component", ph_ach_limit: "0.8" },
      co2: { epa_subgrid_name: "NY (NYCW)", taget_co2_per_person: "4.0" },
      mechanical: { erv: { manufacturer_name: "Zehnder America" } },
      user_defined: { cad_received_date: "May 1, 2026" },
    },
  }),
  "project.yaml",
);
assert.equal(withNarrative.narrative.certification.target, "EnerPHit by Component");
assert.equal(withNarrative.narrative.co2.epa_subgrid_name, "NY (NYCW)");
assert.equal(withNarrative.narrative.co2.taget_co2_per_person, "4.0");
assert.equal(withNarrative.narrative.mechanical.erv.manufacturer_name, "Zehnder America");
assert.equal(withNarrative.narrative.user_defined.cad_received_date, "May 1, 2026");

// Coercion (coerceTypes): a bare number in a string narrative field and a
// stringified number in the numeric occupants field are accepted and cast to
// the schema's declared type, mirroring coerce_numbers_to_str on the Python
// side so both validators accept the same loose inputs.
const coerced = parseProjectYaml(
  toYaml({
    ...baseProject,
    building: { ...baseProject.building, total_num_occupants: "7" },
    narrative: { co2: { taget_co2_per_person: 2, target_tons: 6 } },
  }),
  "project.yaml",
);
assert.equal(coerced.building.total_num_occupants, 7);
assert.equal(coerced.narrative.co2.taget_co2_per_person, "2");
assert.equal(coerced.narrative.co2.target_tons, "6");

// Bad slugs.
for (const slug of ["Project-2606", "project_2606", "project--2606", "-project-2606", "project-2606-"]) {
  assert.throws(
    () => parseProjectYaml(toYaml({ ...baseProject, slug }), "project.yaml"),
    /slug must match pattern/,
  );
}

// Wrong schema_version.
assert.throws(
  () => parseProjectYaml(toYaml({ ...baseProject, schema_version: "0.1.0" }), "project.yaml"),
  /schema_version must equal "0.2.0"/,
);

// Bad email.
assert.throws(
  () => parseProjectYaml(toYaml({ ...baseProject, contact_email: "not-an-email" }), "project.yaml"),
  /contact_email must match pattern/,
);

// Bad publishing URL.
assert.throws(
  () =>
    parseProjectYaml(
      toYaml({
        ...baseProject,
        publishing: { ...baseProject.publishing, production_url: "http://insecure.example.com" },
      }),
      "project.yaml",
    ),
  /publishing\.production_url must match pattern/,
);

// Bad publishing access mode and email.
assert.throws(
  () =>
    parseProjectYaml(
      toYaml({
        ...baseProject,
        publishing: { ...baseProject.publishing, access: { mode: "password", allowed_emails: [] } },
      }),
      "project.yaml",
    ),
  /publishing\.access\.mode must be equal to one of the allowed values/,
);
assert.throws(
  () =>
    parseProjectYaml(
      toYaml({
        ...baseProject,
        publishing: {
          ...baseProject.publishing,
          access: { mode: "cloudflare_access_otp", allowed_emails: ["not-an-email"] },
        },
      }),
      "project.yaml",
    ),
  /publishing\.access\.allowed_emails\.0 must match pattern/,
);

// Repo-relative path violation.
assert.throws(
  () =>
    parseProjectYaml(
      toYaml({
        ...baseProject,
        source_files: { ...baseProject.source_files, data_dir: "/absolute/data" },
      }),
      "project.yaml",
    ),
  /source_files\.data_dir must match pattern/,
);

// Typo in narrative section name (extra-key check).
assert.throws(
  () =>
    parseProjectYaml(
      toYaml({
        ...baseProject,
        narrative: { mechancial: { erv: {} } }, // typo: mechancial
      }),
      "project.yaml",
    ),
  /unknown property "mechancial"/,
);

console.log("project-schema ajv validation ok");
