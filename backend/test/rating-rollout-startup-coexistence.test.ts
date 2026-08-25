// TS: 2026-08-25 17:06 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL("../../.github/workflows/rating-rollout-worker.yml", import.meta.url);

async function readWorkflow(): Promise<string> {
  return readFile(workflowPath, "utf8");
}

test("earlier startup work blocks redeploy but not bounded direct rating fallback without Render authority", async () => {
  const workflow = await readWorkflow();

  assert.match(
    workflow,
    /if \(earlierJobRunning && hasRenderAuthority\) \{[\s\S]*?do not interrupt it with another Render redeploy[\s\S]*?process\.exit\(0\);[\s\S]*?\}/,
    "Earlier startup work must still block an authorized Render redeploy.",
  );

  assert.match(
    workflow,
    /if \(earlierJobRunning && !hasRenderAuthority\) \{[\s\S]*?continue with the bounded direct rating fallback without redeploying Render[\s\S]*?\}/,
    "Without Render authority, earlier startup work should allow bounded direct fallback to continue.",
  );

  assert.doesNotMatch(
    workflow,
    /if \(earlierJobRunning\) \{[\s\S]*?process\.exit\(0\);[\s\S]*?\}/,
    "Do not restore an unconditional earlierJobRunning exit that stalls direct rating progress.",
  );
});
