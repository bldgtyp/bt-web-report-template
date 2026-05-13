import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import YAML from "yaml";

const SCHEMA_VERSION = "0.1.0";
const SLUG_PATTERN = /^[0-9]{4}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

const REQUIRED_STRINGS = [
  "schema_version",
  "slug",
  "project_title",
  "client_name",
  "building_name",
  "phase",
  "report_date",
  "prepared_by",
  "contact_email",
  "target_standard",
  "certification_program",
  "certification_path",
];

const REQUIRED_BUILDING_STRINGS = ["address", "city", "state", "climate_zone", "building_type"];
const REQUIRED_SOURCE_STRINGS = ["data_dir", "assets_dir"];
const REQUIRED_PUBLISHING_STRINGS = ["production_url", "cloudflare_pages_project"];

export async function readProjectFile(path) {
  const text = await readFile(path, "utf8");
  return parseProjectYaml(text, path);
}

export function parseProjectYaml(text, source = "project.yaml") {
  let value;
  try {
    value = YAML.parse(text);
  } catch (error) {
    throw new Error(`${source}: invalid YAML: ${error.message}`);
  }

  return validateProjectConfig(value, source);
}

export function validateProjectConfig(value, source = "project.yaml") {
  const errors = [];

  if (!isRecord(value)) {
    throw new Error(`${source}: expected a YAML object`);
  }

  requireStrings(value, REQUIRED_STRINGS, source, errors);

  if (value.schema_version && value.schema_version !== SCHEMA_VERSION) {
    errors.push(`${source}: schema_version must be "${SCHEMA_VERSION}"`);
  }

  if (typeof value.slug === "string" && !SLUG_PATTERN.test(value.slug)) {
    errors.push(`${source}: slug must match <jobnum>-<short-name>, for example 2606-vandam`);
  }

  if (typeof value.contact_email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contact_email)) {
    errors.push(`${source}: contact_email must be a valid email address`);
  }

  requireNestedStrings(value, "building", REQUIRED_BUILDING_STRINGS, source, errors);
  requireNestedStrings(value, "source_files", REQUIRED_SOURCE_STRINGS, source, errors);
  requireNestedStrings(value, "publishing", REQUIRED_PUBLISHING_STRINGS, source, errors);

  if (isRecord(value.source_files)) {
    const phppPath = value.source_files.phpp_path;
    if (phppPath !== undefined && phppPath !== null && typeof phppPath !== "string") {
      errors.push(`${source}: source_files.phpp_path must be a string; use an empty string before PHPP exists`);
    }
    for (const key of ["data_dir", "assets_dir"]) {
      const path = value.source_files[key];
      if (typeof path === "string" && (path.startsWith("~") || isAbsolute(path))) {
        errors.push(`${source}: source_files.${key} must be repo-relative, not machine-specific`);
      }
    }
  }

  if (isRecord(value.publishing) && typeof value.publishing.production_url === "string") {
    try {
      const url = new URL(value.publishing.production_url);
      if (url.protocol !== "https:") {
        errors.push(`${source}: publishing.production_url must use https`);
      }
    } catch {
      errors.push(`${source}: publishing.production_url must be a valid URL`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return value;
}

export function projectPathFromRoot(root = process.cwd()) {
  return resolve(root, "project.yaml");
}

function requireNestedStrings(value, key, fields, source, errors) {
  if (!isRecord(value[key])) {
    errors.push(`${source}: ${key} is required`);
    return;
  }
  requireStrings(value[key], fields, `${source}: ${key}`, errors);
}

function requireStrings(value, fields, source, errors) {
  for (const field of fields) {
    if (typeof value[field] !== "string" || value[field].trim() === "") {
      errors.push(`${source}: ${field} is required`);
    }
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
