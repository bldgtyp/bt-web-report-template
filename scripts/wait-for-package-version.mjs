#!/usr/bin/env node
// Poll a package registry until a specific package@version is published.
//
// Use in CI right before `pnpm install` when a workflow's dependency pin was
// bumped in the same push that triggers an auto-publish on a sibling repo.
// Instead of failing immediately with "version not found", we wait until the
// publish lands (or hit a timeout that's still much shorter than the human
// turn-around for "rerun the action").
//
// Usage:
//   node scripts/wait-for-package-version.mjs <package> <version> [--timeout-seconds=600]
//
// Exit codes:
//   0  version is available
//   1  timed out
//   2  bad arguments / fatal error

import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const POLL_SECONDS = 15;
const DEFAULT_TIMEOUT_SECONDS = 600;

function parseArgs(argv) {
  const positional = [];
  let timeoutSeconds = DEFAULT_TIMEOUT_SECONDS;
  for (const arg of argv) {
    if (arg.startsWith("--timeout-seconds=")) {
      timeoutSeconds = Number.parseInt(arg.split("=", 2)[1], 10);
      if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
        die(2, `invalid --timeout-seconds: ${arg}`);
      }
    } else if (arg.startsWith("--")) {
      die(2, `unknown flag: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length !== 2) {
    die(2, "usage: wait-for-package-version.mjs <package> <version> [--timeout-seconds=N]");
  }
  return { name: positional[0], version: positional[1], timeoutSeconds };
}

function die(code, message) {
  console.error(`wait-for-package-version: ${message}`);
  process.exit(code);
}

function checkOnce(name, version) {
  const result = spawnSync("pnpm", ["view", `${name}@${version}`, "version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status === 0 && result.stdout.trim() === version) {
    return { found: true, detail: result.stdout.trim() };
  }
  return { found: false, detail: (result.stderr || result.stdout || "").trim().slice(0, 200) };
}

async function main() {
  const { name, version, timeoutSeconds } = parseArgs(process.argv.slice(2));
  const deadline = Date.now() + timeoutSeconds * 1000;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    const { found, detail } = checkOnce(name, version);
    if (found) {
      const elapsed = Math.round((attempt - 1) * POLL_SECONDS);
      console.log(`${name}@${version} available after ~${elapsed}s (attempt ${attempt})`);
      return;
    }
    const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    console.log(`${name}@${version} not yet available (attempt ${attempt}, ${remaining}s remaining): ${detail || "not found"}`);
    if (remaining <= 0) break;
    await sleep(Math.min(POLL_SECONDS, remaining) * 1000);
  }
  die(1, `timed out after ${timeoutSeconds}s waiting for ${name}@${version}`);
}

main().catch((err) => die(2, err?.stack || String(err)));
