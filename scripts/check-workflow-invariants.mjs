#!/usr/bin/env node
// Static checks on .github/workflows/_renderer-build.yml that enforce the
// invariants that have failed in the past. Each check explains the failure
// mode in plain English so you can fix it without re-deriving why.
//
// Run as: node scripts/check-workflow-invariants.mjs
// Exits 0 on success, 1 on any invariant violation.

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(moduleDir, "..");
const workflowPath = resolve(repoRoot, ".github/workflows/_renderer-build.yml");

if (!existsSync(workflowPath)) {
  console.error(`check-workflow-invariants: cannot find ${workflowPath}`);
  process.exit(1);
}

const doc = YAML.parse(readFileSync(workflowPath, "utf8"));

const failures = [];

function fail(invariant, detail) {
  failures.push({ invariant, detail });
}

// --- Invariant 1 ----------------------------------------------------------
// BTWR_PROJECT_SCHEMA_JSON MUST be set at job level, not step level. If it's
// only on the validate step, pnpm build's internal validate has no env and
// falls back to the stale registry schema. This is the bug that produced
// "narrative.climate has unknown property 'ashrae_winter_design_temp_F'"
// in run 70350151485.
{
  const buildJob = doc?.jobs?.build;
  if (!buildJob) {
    fail("structure", "jobs.build is missing");
  } else {
    const jobEnv = buildJob.env ?? {};
    if (!("BTWR_PROJECT_SCHEMA_JSON" in jobEnv)) {
      fail(
        "BTWR_PROJECT_SCHEMA_JSON-must-be-job-level",
        "jobs.build.env must define BTWR_PROJECT_SCHEMA_JSON. " +
          "Per-step env does not propagate into nested pnpm script chains, " +
          "so `pnpm build` (which internally re-runs `pnpm validate`) would " +
          "fall back to the stale registry schema and fail.",
      );
    }
    // Also assert no step REDEFINES it (a step-level override would shadow
    // the job env for that step). Allow steps to add OTHER env keys.
    for (const step of buildJob.steps ?? []) {
      if (step?.env && "BTWR_PROJECT_SCHEMA_JSON" in step.env) {
        fail(
          "BTWR_PROJECT_SCHEMA_JSON-must-not-be-step-level",
          `step "${step.name ?? step.id ?? "(unnamed)"}" redefines BTWR_PROJECT_SCHEMA_JSON. ` +
            "Only the job-level definition should set it.",
        );
      }
    }
  }
}

// --- Invariant 2 ----------------------------------------------------------
// Every step that hits an external network (Cloudflare, npm registry, GitHub
// Packages tag-push) must use scripts/retry.sh. A bare command means one
// transient blip = pipeline failure.
{
  const buildJob = doc?.jobs?.build;
  const deployJob = doc?.jobs?.deploy;
  const networkPatterns = [
    { pattern: /pnpm install\b/, label: "pnpm install" },
    { pattern: /wrangler pages deploy\b/, label: "wrangler pages deploy" },
    { pattern: /setup-cloudflare-pages\.mjs\b/, label: "setup-cloudflare-pages" },
  ];
  for (const [jobName, job] of Object.entries({ build: buildJob, deploy: deployJob })) {
    if (!job) continue;
    for (const step of job.steps ?? []) {
      const run = step?.run;
      if (typeof run !== "string") continue;
      for (const { pattern, label } of networkPatterns) {
        if (pattern.test(run) && !run.includes("retry.sh")) {
          fail(
            "network-step-must-retry",
            `jobs.${jobName} step "${step.name ?? "(unnamed)"}" runs '${label}' without retry.sh. ` +
              "Wrap network-dependent commands so transient 5xx/DNS/rate-limit blips don't fail the pipeline.",
          );
        }
      }
    }
  }
}

// --- Invariant 3 ----------------------------------------------------------
// The deploy job must depend on build and gate on inputs.run-deploy.
{
  const deploy = doc?.jobs?.deploy;
  if (!deploy) {
    fail("structure", "jobs.deploy is missing");
  } else {
    if (deploy.needs !== "build" && !(Array.isArray(deploy.needs) && deploy.needs.includes("build"))) {
      fail("deploy-needs-build", "jobs.deploy.needs must include 'build' so the artifact exists.");
    }
    const condition = deploy.if ?? "";
    if (!/run-deploy/.test(String(condition))) {
      fail("deploy-must-gate-on-run-deploy", "jobs.deploy.if must reference inputs.run-deploy.");
    }
  }
}

// --- Report ---------------------------------------------------------------
if (failures.length === 0) {
  console.log("check-workflow-invariants: OK");
  process.exit(0);
}

console.error("check-workflow-invariants: VIOLATIONS\n");
for (const { invariant, detail } of failures) {
  console.error(`  [${invariant}]`);
  console.error(`    ${detail}\n`);
}
process.exit(1);
