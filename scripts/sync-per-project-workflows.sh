#!/usr/bin/env bash
# Force every per-project repo in the bldgtyp-projects org to (a) use the
# canonical minimal reusable-workflow form for ci.yml/deploy.yml, AND
# (b) have all required-by-the-template content files. Files that already
# exist in the per-project repo are NEVER touched — the sync is additive.
#
# Idempotent: if everything already matches, the script makes no commits.
#
# Usage:
#   scripts/sync-per-project-workflows.sh                # all repos in bldgtyp-projects
#   scripts/sync-per-project-workflows.sh <repo>...      # only the listed repos
#   scripts/sync-per-project-workflows.sh --dry-run      # show what would change, don't push
#
# Prerequisites: gh CLI authenticated with push access to bldgtyp-projects.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RENDERER_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CI_TEMPLATE="$SCRIPT_DIR/per-project-ci.yml"
DEPLOY_TEMPLATE="$SCRIPT_DIR/per-project-deploy.yml"

# Discover required section MDX files from validate-project.mjs so this
# script and the validator can never drift. Reads REQUIRED_SECTION_FILES.
# (Using `while read` for bash 3.x compatibility — mapfile is bash 4+.)
REQUIRED_CONTENT_FILES=()
while IFS= read -r line; do
  REQUIRED_CONTENT_FILES+=("$line")
done < <(node -e '
import("fs").then((fs) => {
  const text = fs.readFileSync(process.argv[1], "utf8");
  const m = text.match(/REQUIRED_SECTION_FILES\s*=\s*\[([\s\S]*?)\];/);
  if (!m) { process.exit(1); }
  const items = m[1].match(/"([^"]+)"/g) || [];
  for (const it of items) console.log(it.slice(1, -1));
});
' "$RENDERER_ROOT/scripts/validate-project.mjs")

if [ ! -f "$CI_TEMPLATE" ] || [ ! -f "$DEPLOY_TEMPLATE" ]; then
  echo "sync-per-project-workflows: cannot find templates at $CI_TEMPLATE / $DEPLOY_TEMPLATE" >&2
  exit 1
fi

DRY_RUN=0
REPOS=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) REPOS+=("$arg") ;;
  esac
done

if [ "${#REPOS[@]}" -eq 0 ]; then
  echo "Discovering per-project repos in bldgtyp-projects org..."
  while read -r repo; do
    [ -z "$repo" ] && continue
    REPOS+=("$repo")
  done < <(gh repo list bldgtyp-projects --limit 100 --json nameWithOwner --jq '.[].nameWithOwner')
fi

if [ "${#REPOS[@]}" -eq 0 ]; then
  echo "No per-project repos found."
  exit 0
fi

WORK_DIR="$(mktemp -d -t btwr-sync-workflows.XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

updated=0
unchanged=0
failed=0

for repo in "${REPOS[@]}"; do
  echo
  echo "================================================================================"
  echo "  $repo"
  echo "================================================================================"
  cd "$WORK_DIR"
  repo_name="${repo#*/}"
  rm -rf "$repo_name"
  if ! gh repo clone "$repo" "$repo_name" -- --depth=1 --quiet 2>&1; then
    echo "  ERROR: clone failed"
    failed=$((failed + 1))
    continue
  fi
  cd "$repo_name"

  mkdir -p .github/workflows
  needs_update=0
  changes=()
  if ! cmp -s "$CI_TEMPLATE" .github/workflows/ci.yml; then
    needs_update=1; changes+=(".github/workflows/ci.yml")
  fi
  if ! cmp -s "$DEPLOY_TEMPLATE" .github/workflows/deploy.yml; then
    needs_update=1; changes+=(".github/workflows/deploy.yml")
  fi

  # Additive content sync: copy any template-required content file that the
  # per-project doesn't have. Never overwrites existing files (the per-project
  # owns its content). Catches the "template added a new section, every
  # existing project breaks on next CI run" cascade.
  for relpath in "${REQUIRED_CONTENT_FILES[@]}"; do
    src="$RENDERER_ROOT/$relpath"
    if [ ! -f "$src" ]; then
      echo "  WARNING: template source missing $relpath — skipping"
      continue
    fi
    if [ -f "$relpath" ]; then
      continue  # per-project already has it; leave alone
    fi
    mkdir -p "$(dirname "$relpath")"
    cp "$src" "$relpath"
    needs_update=1
    changes+=("$relpath")
  done

  if [ "$needs_update" = "0" ]; then
    echo "  already canonical"
    unchanged=$((unchanged + 1))
    continue
  fi

  cp "$CI_TEMPLATE" .github/workflows/ci.yml
  cp "$DEPLOY_TEMPLATE" .github/workflows/deploy.yml

  echo "  changes:"
  for path in "${changes[@]}"; do
    echo "    $path"
  done

  if [ "$DRY_RUN" = "1" ]; then
    echo "  (dry-run — not pushing)"
    updated=$((updated + 1))
    continue
  fi

  git -c user.name="bt-web-report-sync" -c user.email="phtools@bldgtyp.com" add "${changes[@]}"
  if git diff --cached --quiet; then
    echo "  no diff after staging — odd, skipping"
    unchanged=$((unchanged + 1))
    continue
  fi
  git -c user.name="bt-web-report-sync" -c user.email="phtools@bldgtyp.com" commit -m "Sync per-project from template canonical state

Workflows updated to the reusable-workflow form; any new template-required
content files were added (additive only — existing per-project content
is never touched). See bldgtyp/bt-web-report-template
scripts/sync-per-project-workflows.sh."
  git push origin HEAD
  echo "  pushed"
  updated=$((updated + 1))
done

echo
echo "================================================================================"
echo "  SUMMARY"
echo "================================================================================"
echo "  updated:   $updated"
echo "  unchanged: $unchanged"
echo "  failed:    $failed"

exit "$failed"
