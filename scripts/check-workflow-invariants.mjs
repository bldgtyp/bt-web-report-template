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
const templateDeployWorkflowPath = resolve(repoRoot, ".github/workflows/deploy.yml");

if (!existsSync(workflowPath)) {
  console.error(`check-workflow-invariants: cannot find ${workflowPath}`);
  process.exit(1);
}

const doc = YAML.parse(readFileSync(workflowPath, "utf8"));
const templateDeployDoc = existsSync(templateDeployWorkflowPath)
  ? YAML.parse(readFileSync(templateDeployWorkflowPath, "utf8"))
  : null;

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

// --- Invariant 4 ----------------------------------------------------------
// Source directories that contain relative MDX imports must be copied into the
// runtime workspace, not symlinked. If runtime/src points to renderer/src,
// imports like "../../content/summary.mdx" resolve against renderer/content
// and deployed project pages silently render template MDX instead of the
// per-project content repository.
{
  const buildJob = doc?.jobs?.build;
  const prepareStep = (buildJob?.steps ?? []).find((step) => step?.name === "Prepare content-only runtime");
  const run = prepareStep?.run;
  if (typeof run !== "string") {
    fail("prepare-runtime-step-missing", 'jobs.build must include a "Prepare content-only runtime" run step.');
  } else {
    if (!/cp -a renderer\/src runtime\/src/.test(run)) {
      fail(
        "runtime-src-must-be-copied",
        "Prepare content-only runtime must copy renderer/src into runtime/src. " +
          "Symlinking src makes relative MDX imports resolve from renderer/content instead of project content.",
      );
    }
    if (!/cp -a renderer\/tina runtime\/tina/.test(run)) {
      fail(
        "runtime-tina-must-be-copied",
        "Prepare content-only runtime must copy renderer/tina into runtime/tina so editor-relative paths stay inside the runtime.",
      );
    }
    const symlinkLoop = run.match(/for item in ([^;]+); do/);
    const symlinkItems = symlinkLoop?.[1]?.trim().split(/\s+/) ?? [];
    for (const disallowed of ["src", "tina"]) {
      if (symlinkItems.includes(disallowed)) {
        fail(
          "runtime-source-dirs-must-not-be-symlinked",
          `Prepare content-only runtime symlinks ${disallowed}. Copy source directories instead so relative content imports use runtime/content.`,
        );
      }
    }
  }
}

// --- Invariant 5 ----------------------------------------------------------
// dist/report.pdf must be produced as part of the standard build pipeline.
// The Cloudflare Pages publish picks up dist/ wholesale, so if "Build PDF"
// is skipped or removed, every deploy ships without the /report.pdf artifact
// the cover-page "Download PDF" button links to.
{
  const buildJob = doc?.jobs?.build;
  const steps = buildJob?.steps ?? [];
  const buildStepIdx = steps.findIndex((step) => step?.name === "Build");
  const buildPdfStepIdx = steps.findIndex((step) => step?.name === "Build PDF");
  const playwrightInstallIdx = steps.findIndex(
    (step) => step?.name && /Install Playwright/i.test(step.name),
  );

  if (buildPdfStepIdx < 0) {
    fail(
      "build-pdf-step-missing",
      'jobs.build must include a "Build PDF" step that runs scripts/build-pdf.mjs. ' +
        "Without it, dist/report.pdf is never produced and the cover-page Download PDF button 404s.",
    );
  }
  if (playwrightInstallIdx < 0) {
    fail(
      "playwright-install-step-missing",
      "jobs.build must install Playwright's Chromium before the PDF build step.",
    );
  }
  if (buildStepIdx >= 0 && buildPdfStepIdx >= 0 && buildPdfStepIdx <= buildStepIdx) {
    fail(
      "build-pdf-step-order",
      'The "Build PDF" step must run AFTER the "Build" step ' +
        "(build-pdf.mjs consumes dist/ produced by astro build).",
    );
  }
  if (buildPdfStepIdx >= 0) {
    const run = steps[buildPdfStepIdx]?.run ?? "";
    if (!/build-pdf\.mjs/.test(run)) {
      fail(
        "build-pdf-step-content",
        'The "Build PDF" step must invoke scripts/build-pdf.mjs.',
      );
    }
  }
}

// --- Invariant 6 ----------------------------------------------------------
// The local emulator (scripts/ci-emulate.sh) must symlink the SAME set of
// files into runtime/ as the workflow does. Drift between them is how
// "works locally / fails in CI" bugs sneak in. We parse the symlink loop
// out of both files and require exact equality (order-independent).
{
  const buildJob = doc?.jobs?.build;
  const prepareStep = (buildJob?.steps ?? []).find((step) => step?.name === "Prepare content-only runtime");
  const workflowRun = prepareStep?.run ?? "";
  const workflowMatch = workflowRun.match(/for item in ([^;]+); do/);
  const workflowItems = workflowMatch?.[1]?.trim().split(/\s+/) ?? [];

  const emulatorPath = resolve(repoRoot, "scripts/ci-emulate.sh");
  if (!existsSync(emulatorPath)) {
    fail("ci-emulate-missing", `scripts/ci-emulate.sh not found at ${emulatorPath}`);
  } else {
    const emulatorSrc = readFileSync(emulatorPath, "utf8");
    // Anchor to the "Prepare content-only runtime" section header so we don't
    // accidentally pick up earlier `for item in …` loops (the rsync step
    // higher up uses the same shape for project.yaml/content/data/public).
    const sectionMatch = emulatorSrc.match(
      /Prepare content-only runtime[\s\S]*?for item in ([^;]+); do[\s\S]*?ln -s/,
    );
    const emulatorItems = sectionMatch?.[1]?.trim().split(/\s+/) ?? [];

    if (workflowItems.length === 0 || emulatorItems.length === 0) {
      fail(
        "symlink-loop-unparseable",
        "Could not parse the 'for item in … ; do' symlink loop from either the workflow or the emulator. " +
          "Both must use that exact shape so drift can be detected.",
      );
    } else {
      const sortedWorkflow = [...workflowItems].sort();
      const sortedEmulator = [...emulatorItems].sort();
      const same = sortedWorkflow.length === sortedEmulator.length &&
        sortedWorkflow.every((item, i) => item === sortedEmulator[i]);
      if (!same) {
        const onlyInWorkflow = sortedWorkflow.filter((x) => !sortedEmulator.includes(x));
        const onlyInEmulator = sortedEmulator.filter((x) => !sortedWorkflow.includes(x));
        fail(
          "ci-emulate-symlink-drift",
          "scripts/ci-emulate.sh symlink loop has drifted from .github/workflows/_renderer-build.yml. " +
            `Only in workflow: [${onlyInWorkflow.join(", ") || "(none)"}]. ` +
            `Only in emulator: [${onlyInEmulator.join(", ") || "(none)"}]. ` +
            "Update the emulator so local `pnpm test:ci` reproduces what GitHub Actions actually does.",
        );
      }
    }
  }
}

// --- Invariant 7 ----------------------------------------------------------
// The template repo's own deploy is a demo deploy. It must never manage a
// real project's custom domain from the seed project.yaml; per-project repos
// own project-<number>.bldgtyp.com DNS.
{
  if (!templateDeployDoc) {
    fail("template-deploy-workflow-missing", `Cannot find ${templateDeployWorkflowPath}`);
  } else {
    const deployJob = templateDeployDoc?.jobs?.deploy;
    const manageCustomDomain = deployJob?.with?.["manage-custom-domain"];
    if (manageCustomDomain !== false) {
      fail(
        "template-deploy-must-not-manage-custom-domain",
        ".github/workflows/deploy.yml must pass `manage-custom-domain: false` to _renderer-build.yml. " +
          "The template deploy builds pending seed data and must not rewire project-<number>.bldgtyp.com DNS.",
      );
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
