#!/usr/bin/env bash
# Force every per-project repo in the bldgtyp-projects org to use the
# canonical minimal reusable-workflow form for ci.yml and deploy.yml.
#
# Idempotent: if the workflow files already match the canonical templates,
# the script makes no commits.
#
# Usage:
#   scripts/sync-per-project-workflows.sh                # all repos in bldgtyp-projects
#   scripts/sync-per-project-workflows.sh <repo>...      # only the listed repos
#   scripts/sync-per-project-workflows.sh --dry-run      # show what would change, don't push
#
# Prerequisites: gh CLI authenticated with push access to bldgtyp-projects.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CI_TEMPLATE="$SCRIPT_DIR/per-project-ci.yml"
DEPLOY_TEMPLATE="$SCRIPT_DIR/per-project-deploy.yml"

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
  if ! cmp -s "$CI_TEMPLATE" .github/workflows/ci.yml; then needs_update=1; fi
  if ! cmp -s "$DEPLOY_TEMPLATE" .github/workflows/deploy.yml; then needs_update=1; fi

  if [ "$needs_update" = "0" ]; then
    echo "  already canonical"
    unchanged=$((unchanged + 1))
    continue
  fi

  cp "$CI_TEMPLATE" .github/workflows/ci.yml
  cp "$DEPLOY_TEMPLATE" .github/workflows/deploy.yml

  if [ "$DRY_RUN" = "1" ]; then
    echo "  would update (dry-run):"
    git --no-pager diff --stat
    updated=$((updated + 1))
    continue
  fi

  git -c user.name="bt-web-report-sync" -c user.email="phtools@bldgtyp.com" add .github/workflows/ci.yml .github/workflows/deploy.yml
  if git diff --cached --quiet; then
    echo "  no diff after staging — odd, skipping"
    unchanged=$((unchanged + 1))
    continue
  fi
  git -c user.name="bt-web-report-sync" -c user.email="phtools@bldgtyp.com" commit -m "Sync per-project workflows to canonical reusable form

Per bldgtyp/bt-web-report-template scripts/per-project-{ci,deploy}.yml.
This propagates schema sibling-checkout, wait-for-publish, retry-with-
backoff, and the build/deploy job split to this project's next CI run."
  git push origin HEAD
  echo "  updated and pushed"
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
