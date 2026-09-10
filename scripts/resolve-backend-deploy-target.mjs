// TS: 2026-09-10 13:00 ET

import { execFileSync } from "node:child_process";

const DEPLOY_RELEVANT_PATHS = Object.freeze([
  "backend",
  "render.yaml",
]);
const RATING_ROLLOUT_KICK_PATTERN = /^(?:backend\/src\/policy\/rating-rollout-kick-[\d-]+\.ts|backend\/src\/ratings\/\.worker-kick-[\d-]+\.md)$/;
const BACKEND_TEST_PATTERN = /^backend\/test\//;

function git(arguments_, cwd) {
  return execFileSync("git", arguments_, { cwd, encoding: "utf8" }).trim();
}

function changedPatchLines(patch) {
  return patch
    .split("\n")
    .filter((line) => (line.startsWith("+") || line.startsWith("-")) && !line.startsWith("+++") && !line.startsWith("---"));
}

export function isTimestampOnlyPatch(patch) {
  const changedLines = changedPatchLines(patch);
  return changedLines.length > 0 && changedLines.every((line) => (
    /^[-+]\s*\/\/ TS: /.test(line) ||
    /^[-+]\s*# TS: /.test(line) ||
    /^[-+]\s*<!-- TS: .* -->\s*$/.test(line)
  ));
}

export function isTimestampOnlyRenderPatch(patch) {
  return isTimestampOnlyPatch(patch);
}

export function isRatingRolloutKickOnly(changedFiles) {
  return changedFiles.length > 0 && changedFiles.every((file) => RATING_ROLLOUT_KICK_PATTERN.test(file));
}

export function isBackendTestOnly(changedFiles) {
  return changedFiles.length > 0 && changedFiles.every((file) => BACKEND_TEST_PATTERN.test(file));
}

function isDeployRelevantCommit(sha, cwd) {
  const changedFiles = git(["diff-tree", "--no-commit-id", "--name-only", "-r", sha], cwd)
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);

  if (isRatingRolloutKickOnly(changedFiles) || isBackendTestOnly(changedFiles)) {
    return false;
  }

  const backendFiles = changedFiles.filter((file) => file === "backend" || file.startsWith("backend/"));
  if (backendFiles.length > 0) {
    const backendChangesAreTimestampOnly = backendFiles.every((file) => {
      const patch = git(["show", "--format=", "--unified=0", sha, "--", file], cwd);
      return isTimestampOnlyPatch(patch);
    });
    if (!backendChangesAreTimestampOnly) {
      return true;
    }
  }

  if (!changedFiles.includes("render.yaml")) {
    return false;
  }

  const patch = git(["show", "--format=", "--unified=0", sha, "--", "render.yaml"], cwd);
  return !isTimestampOnlyRenderPatch(patch);
}

export function resolveLatestBackendRelevantCommit({ cwd = process.cwd() } = {}) {
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

export function resolveBackendDeployTarget({ cwd = process.cwd() } = {}) {
  // Render is configured to deploy branch main with autoDeployTrigger=commit.
  // The production startup gate must therefore compare against the exact
  // deployable main SHA, not a pre-merge PR head or backend-only ancestor.
  const sha = git(["rev-parse", "HEAD"], cwd);
  if (!sha || !/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error("Unable to resolve the exact deployable main commit.");
  }
  return sha;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${resolveBackendDeployTarget()}\n`);
}
