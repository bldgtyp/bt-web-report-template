import { mkdtemp, rm, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const dataDir = join(projectRoot, "data");
const fixtureDir = resolve(projectRoot, "../bt-web-report-kit/src/showcase/data/vandam");
const backupParent = await mkdtemp(join(tmpdir(), "btwr-template-data-"));
const backupDataDir = join(backupParent, "data");

const commands = [
  ["pnpm", ["validate"]],
  ["pnpm", ["check"]],
  ["pnpm", ["build"]],
  ["pnpm", ["test:e2e"]],
];

try {
  if (!existsSync(fixtureDir)) {
    throw new Error(`Missing fixture data: ${fixtureDir}`);
  }

  await cp(dataDir, backupDataDir, { recursive: true });
  await rm(dataDir, { recursive: true, force: true });
  await cp(fixtureDir, dataDir, { recursive: true });

  for (const [command, args] of commands) {
    const result = spawnSync(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (result.status !== 0) {
      throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
    }
  }
} finally {
  await rm(dataDir, { recursive: true, force: true });
  if (existsSync(backupDataDir)) {
    await cp(backupDataDir, dataDir, { recursive: true });
  }
  await rm(backupParent, { recursive: true, force: true });
}
