// TS: 2026-08-22 23:58 ET

import { execFileSync } from "node:child_process";

const DEPLOY_RELEVANT_PATHS = Object.freeze([
  "backend",
  "render.yaml",
]);
const RATING_ROLLOUT_KICK_PATTERN = /^backend\/src\/policy\/rating-rollout-kick-\d+\.ts$/;

function git(arguments_, cwd) {
  return execFileSync("git", arguments_, { cwd, encoding: "utf8" }).trim();
}

export function isTimestampOnlyRenderPatch(patch) {
  const changedLines = patch
    .split("\n")
    .filter((line) => (line.startsWith("+") || line.startsWith("-")) && !line.startsWith("+++") && !line.startsWith("---"));

  return changedLines.length > 0 && changedLines.every((line) => /^[-+]# TS: /.test(line));
}

export function isRatingRolloutKickOnly(changedFiles) {
  return changedFiles.length > 0 && changedFiles.every((file) => RATING_ROLLOUT_KICK_PATTERN.test(file));
}

function isDeployRelevantCommit(sha, cwd) {
  const changedFiles = git(["diff-tree", "--no-commit-id", "--name-only", "-r", sha], cwd)
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);

  if (isRatingRolloutKickOnly(changedFiles)) {
    return false;
  }

  if (changedFiles.some((file) => file === "backend" || file.startsWith("backend/"))) {
    return true;
  }

  if (!changedFiles.includes("render.yaml")) {
    return false;
  }

  const patch = git(["show", "--format=", "--unified=0", sha, "--", "render.yaml"], cwd);
  return !isTimestampOnlyRenderPatch(patch);
}

export function resolveBackendDeployTarget({ cwd = process.cwd() } = {}) {
  const candidates = git([
    "log",
    "--format=%H",
    "--",
    ...DEPLOY_RELEVANT_PATHS,
  ], cwd)
    .split("\n")
    .map((sha) => sha.trim())
    .filter(Boolean);

  const sha = candidates.find((candidate) => isDeployRelevantCommit(candidate, cwd));
  if (!sha || !/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error("Unable to resolve the latest backend-deploy-relevant commit.");
  }
  return sha;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${resolveBackendDeployTarget()}\n`);
}
