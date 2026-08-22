// TS: 2026-08-22 15:00 ET

import { execFileSync } from "node:child_process";

const DEPLOY_RELEVANT_PATHS = Object.freeze([
  "backend",
  "render.yaml",
]);

export function resolveBackendDeployTarget({ cwd = process.cwd() } = {}) {
  const args = [
    "log",
    "-1",
    "--format=%H",
    "--",
    ...DEPLOY_RELEVANT_PATHS,
  ];
  const sha = execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error("Unable to resolve the latest backend-deploy-relevant commit.");
  }
  return sha;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${resolveBackendDeployTarget()}\n`);
}
