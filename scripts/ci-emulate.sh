#!/usr/bin/env bash
# Replicate the GitHub Actions `_renderer-build.yml` build job locally.
#
# Run this BEFORE pushing if you want to know whether CI will pass. It builds
# a fresh sandbox under /tmp that mirrors the runner's workspace layout —
# crucially, the workspace-sibling schema is NOT visible to the validator,
# so the only way validation passes is via BTWR_PROJECT_SCHEMA_JSON pointing
# at the source-of-truth schemas repo (exactly what CI does).
#
# This catches the entire class of "works locally, fails in CI" bugs that
# come from the validator falling back to different schema sources in
# different environments.
#
# Usage:
#   scripts/ci-emulate.sh                  # uses current workspace (../bt-web-report-schemas)
#   scripts/ci-emulate.sh --skip-install   # reuse a prior install (faster iteration)
#   scripts/ci-emulate.sh --keep-sandbox   # don't delete the sandbox on exit
#
# Env overrides:
#   BTWR_SANDBOX_DIR=/tmp/foo              # where to materialise the sandbox
#   BTWR_RENDERER_DIR=<path>               # alternative renderer source (default: this repo)
#   BTWR_PROJECT_DIR=<path>                # alternative project content (default: this repo)
#   BTWR_SCHEMAS_DIR=<path>                # alternative schemas repo (default: ../bt-web-report-schemas)

set -euo pipefail

# Resolve invocation context.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDERER_DIR="${BTWR_RENDERER_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
PROJECT_DIR="${BTWR_PROJECT_DIR:-$RENDERER_DIR}"
SCHEMAS_DIR="${BTWR_SCHEMAS_DIR:-$(cd "$RENDERER_DIR/../bt-web-report-schemas" && pwd)}"
SANDBOX_DIR="${BTWR_SANDBOX_DIR:-/tmp/btwr-ci-emulate-$$}"

SKIP_INSTALL=0
KEEP_SANDBOX=0
for arg in "$@"; do
  case "$arg" in
    --skip-install) SKIP_INSTALL=1 ;;
    --keep-sandbox) KEEP_SANDBOX=1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "ci-emulate: unknown flag: $arg" >&2; exit 2 ;;
  esac
done

cleanup() {
  if [ "$KEEP_SANDBOX" = "1" ]; then
    echo
    echo "ci-emulate: sandbox preserved at $SANDBOX_DIR"
  else
    rm -rf "$SANDBOX_DIR"
  fi
}
trap cleanup EXIT

step() {
  echo
  echo "================================================================================"
  echo "==  $*"
  echo "================================================================================"
}

require_dir() {
  if [ ! -d "$1" ]; then
    echo "ci-emulate: required dir does not exist: $1" >&2
    exit 1
  fi
}

require_dir "$RENDERER_DIR"
require_dir "$PROJECT_DIR"
require_dir "$SCHEMAS_DIR"

if [ ! -f "$SCHEMAS_DIR/schemas/project.schema.json" ]; then
  echo "ci-emulate: schemas repo missing schemas/project.schema.json. Did you run 'uv run gen-json-schemas'?" >&2
  exit 1
fi

echo "ci-emulate config:"
echo "  RENDERER_DIR = $RENDERER_DIR"
echo "  PROJECT_DIR  = $PROJECT_DIR"
echo "  SCHEMAS_DIR  = $SCHEMAS_DIR"
echo "  SANDBOX_DIR  = $SANDBOX_DIR"

step "0. Build sandbox (no workspace-sibling schema visible)"
rm -rf "$SANDBOX_DIR"
mkdir -p "$SANDBOX_DIR"
# Mirror the GH Actions layout: renderer/ project/ schemas-src/ at sandbox root.
# Use rsync excluding the things CI doesn't have (.git, node_modules, dist, .astro).
RSYNC_EXCLUDES=(--exclude .git --exclude node_modules --exclude dist --exclude .astro --exclude .wrangler --exclude test-results --exclude playwright-report --exclude '*.log')
rsync -a "${RSYNC_EXCLUDES[@]}" "$RENDERER_DIR/" "$SANDBOX_DIR/renderer/"
rsync -a "${RSYNC_EXCLUDES[@]}" "$PROJECT_DIR/" "$SANDBOX_DIR/project/"
# For project, we only really need project.yaml + content/ + data/ + public/.
# Mirror that subset.
for item in project.yaml content data public; do
  if [ -e "$PROJECT_DIR/$item" ]; then
    rm -rf "$SANDBOX_DIR/project/$item"
    cp -a "$PROJECT_DIR/$item" "$SANDBOX_DIR/project/$item"
  fi
done
rsync -a "${RSYNC_EXCLUDES[@]}" "$SCHEMAS_DIR/" "$SANDBOX_DIR/schemas-src/"

# Critical: the validator looks for a workspace sibling at
# renderer/../../../bt-web-report-schemas/schemas/project.schema.json.
# Sandbox layout has no such sibling. Verify.
SIBLING_PATH="$SANDBOX_DIR/renderer/../../../bt-web-report-schemas/schemas/project.schema.json"
if [ -f "$SIBLING_PATH" ]; then
  echo "ci-emulate: WARNING — workspace sibling schema exists at $SIBLING_PATH, sandbox not isolated. The emulator will still test the env-var path but will not reproduce the missing-sibling case."
fi

cd "$SANDBOX_DIR"

if [ "$SKIP_INSTALL" = "0" ]; then
  step "1. Install renderer dependencies (mirrors CI 'pnpm install')"
  pushd renderer >/dev/null
  pnpm install --ignore-scripts --no-frozen-lockfile
  popd >/dev/null
else
  step "1. SKIPPED pnpm install (--skip-install)"
  if [ ! -d "renderer/node_modules" ]; then
    # First run with --skip-install would fail; symlink in the parent's node_modules
    # if available.
    if [ -d "$RENDERER_DIR/node_modules" ]; then
      ln -s "$RENDERER_DIR/node_modules" "renderer/node_modules"
    else
      echo "ci-emulate: --skip-install but renderer has no node_modules anywhere"
      exit 1
    fi
  fi
fi

step "2. Prepare content-only runtime (mirrors CI 'Prepare content-only runtime')"
# Keep this symlink list in lock-step with _renderer-build.yml. The
# check-workflow-invariants.mjs script enforces this; if it ever diverges
# silently, the local emulator stops reproducing CI.
mkdir runtime
for item in astro.config.mjs package.json pnpm-lock.yaml playwright playwright.config.ts scripts tests tsconfig.json vitest.config.ts; do
  if [ -e "renderer/$item" ]; then
    ln -s "../renderer/$item" "runtime/$item"
  fi
done
# Copy src/tina (don't symlink) so relative MDX imports resolve from
# runtime/content, mirroring the workflow.
cp -a renderer/src runtime/src
cp -a renderer/tina runtime/tina
ln -s ../renderer/node_modules runtime/node_modules
for item in project.yaml content data public; do
  cp -a "project/$item" "runtime/$item"
done

# This is exactly what CI sets at the JOB level so that EVERY pnpm command
# (including pnpm build which internally calls pnpm validate) uses the
# source-of-truth schema. If the workflow regresses to step-level env, the
# 'Build' step below will fail here.
export BTWR_PROJECT_SCHEMA_JSON="$SANDBOX_DIR/schemas-src/schemas/project.schema.json"
echo "BTWR_PROJECT_SCHEMA_JSON=$BTWR_PROJECT_SCHEMA_JSON"

cd runtime

step "3. Validate (mirrors CI 'Validate project metadata')"
pnpm validate

step "4. Type-check (mirrors CI 'Type-check')"
pnpm check

step "5. Tina editor audit (mirrors CI 'Tina editor audit')"
pnpm check:editor

step "6. Build (mirrors CI 'Build' — this is where env-scope bugs surface)"
pnpm build

step "7. Build PDF (mirrors CI 'Build PDF')"
node scripts/build-pdf.mjs

step "8. Tests (mirrors CI 'Tests' — integration only; renderer unit tests run via 'pnpm test:unit' in the workspace)"
pnpm test:integration

if [ "$PROJECT_DIR" = "$RENDERER_DIR" ]; then
  step "9. Test printable embed fixture (template self-test only)"
  (cd "$RENDERER_DIR" && pnpm test:printable-embed)
fi

echo
echo "================================================================================"
echo "  CI-EMULATE: ALL STEPS PASSED"
echo "================================================================================"
