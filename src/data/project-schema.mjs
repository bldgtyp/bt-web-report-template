// Validator for project.yaml.
//
// All structural and pattern rules are sourced from
// @bldgtyp/web-report-schemas/project.schema.json, which is generated from
// the Pydantic models in bt-web-report-schemas. Do NOT add custom validation
// here — that would re-introduce drift between this validator and the Python
// validator used by the CLI / Manager. If a rule needs to change, change it
// in bt_web_report_schemas/project.py and regenerate.

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import Ajv from "ajv";
import YAML from "yaml";

const requireFromHere = createRequire(import.meta.url);
const projectSchema = requireFromHere("@bldgtyp/web-report-schemas/project.schema.json");

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(projectSchema);

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
  if (validate(value)) {
    return value;
  }
  const messages = (validate.errors ?? []).map((err) => formatError(err, source));
  throw new Error(messages.join("\n"));
}

export function projectPathFromRoot(root = process.cwd()) {
  return resolve(root, "project.yaml");
}

function formatError(err, source) {
  const path = err.instancePath ? err.instancePath.replace(/^\//, "").replaceAll("/", ".") : "(root)";
  switch (err.keyword) {
    case "additionalProperties":
      return `${source}: ${path} has unknown property "${err.params.additionalProperty}"`;
    case "required":
      return `${source}: missing required field "${err.params.missingProperty}"`;
    case "pattern":
      return `${source}: ${path} must match pattern ${err.params.pattern}`;
    case "const":
      return `${source}: ${path} must equal "${err.params.allowedValue}"`;
    case "minLength":
      return `${source}: ${path} must not be empty`;
    case "type":
      return `${source}: ${path} must be a ${err.params.type}`;
    default:
      return `${source}: ${path} ${err.message ?? "is invalid"}`;
  }
}
