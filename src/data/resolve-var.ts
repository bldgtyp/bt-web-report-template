// Dot-path resolver for the <Var k="..." /> shortcode.
//
// Authors reference fields from project.yaml in MDX using dot-paths into the
// validated ProjectConfig shape — e.g. `client_name`, `building.city`,
// `narrative.certification.target`, `narrative.mechanical.erv.type_name`.
// Only string-valued fields are returned; structural paths (e.g. `building`
// or `narrative`) resolve to null so prose can't accidentally inline an
// entire object.

import type { ProjectConfig } from "./project";

export type VarResolution =
  | { found: true; value: string }
  | { found: false; reason: "missing" | "non-string" };

export function resolveVar(project: ProjectConfig, dotPath: string): VarResolution {
  let current: unknown = project;
  for (const part of dotPath.split(".")) {
    if (current === null || current === undefined || typeof current !== "object") {
      return { found: false, reason: "missing" };
    }
    current = (current as Record<string, unknown>)[part];
  }
  if (current === null || current === undefined) {
    return { found: false, reason: "missing" };
  }
  if (typeof current !== "string") {
    return { found: false, reason: "non-string" };
  }
  return { found: true, value: current };
}
