#!/usr/bin/env bash
# Run a command with exponential backoff retries.
#
# Use for any step in CI that hits a network or external API (Cloudflare,
# GitHub Packages, npm registry, etc.). Transient 5xx / DNS / rate-limit
# failures should not fail the whole pipeline — they should retry.
#
# Usage:
#   scripts/retry.sh [--max-attempts=N] [--initial-delay=SECONDS] [--max-delay=SECONDS] -- <command> [args...]
#
# Defaults: 5 attempts, starting at 10s, doubling each time, capped at 120s.
#
# Exits with the final attempt's exit code if all retries are exhausted.

set -u

max_attempts=5
initial_delay=10
max_delay=120
label=""

while [ $# -gt 0 ]; do
  case "$1" in
    --max-attempts=*) max_attempts="${1#*=}"; shift ;;
    --initial-delay=*) initial_delay="${1#*=}"; shift ;;
    --max-delay=*) max_delay="${1#*=}"; shift ;;
    --label=*) label="${1#*=}"; shift ;;
    --) shift; break ;;
    *) echo "retry.sh: unknown option: $1" >&2; exit 2 ;;
  esac
done

if [ $# -eq 0 ]; then
  echo "retry.sh: no command to run" >&2
  exit 2
fi

if [ -z "$label" ]; then
  label="$1"
fi

attempt=1
delay="$initial_delay"
while true; do
  echo "::group::[retry] attempt ${attempt}/${max_attempts}: ${label}"
  status=0
  "$@" || status=$?
  echo "::endgroup::"

  if [ "$status" -eq 0 ]; then
    exit 0
  fi

  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "::error::[retry] ${label} failed after ${max_attempts} attempts (last exit code: ${status})"
    exit "$status"
  fi

  echo "::warning::[retry] ${label} failed on attempt ${attempt} (exit ${status}); retrying in ${delay}s"
  sleep "$delay"
  attempt=$((attempt + 1))
  delay=$((delay * 2))
  if [ "$delay" -gt "$max_delay" ]; then
    delay="$max_delay"
  fi
done
