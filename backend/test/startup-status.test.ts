// TS: 2026-08-02 16:16 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  getStartupStatusSnapshot,
  markStartupJobCompleted,
  markStartupJobFailed,
  markStartupJobRunning,
  resetStartupStatusForTests,
} from "../src/startup-status.js";

test("startup status records successful and failed jobs without exposing secrets", () => {
  const priorCommit = process.env.RENDER_GIT_COMMIT;
  process.env.RENDER_GIT_COMMIT = "abc123";
  resetStartupStatusForTests();

  markStartupJobRunning("universeImport");
  markStartupJobCompleted("universeImport", {
    importedCount: 100,
    database: "postgresql",
  });
  markStartupJobRunning("secUniverseBatch");
  markStartupJobFailed("secUniverseBatch", new Error("SEC request failed"));

  const snapshot = getStartupStatusSnapshot();

  assert.equal(snapshot.deploymentCommit, "abc123");
  assert.equal(snapshot.jobs.universeImport.state, "completed");
  assert.deepEqual(snapshot.jobs.universeImport.summary, {
    importedCount: 100,
    database: "postgresql",
  });
  assert.equal(snapshot.jobs.universeImport.error, null);
  assert.equal(snapshot.jobs.secUniverseBatch.state, "failed");
  assert.equal(snapshot.jobs.secUniverseBatch.error, "SEC request failed");
  assert.equal(snapshot.jobs.pilotRefresh.state, "pending");

  if (priorCommit === undefined) delete process.env.RENDER_GIT_COMMIT;
  else process.env.RENDER_GIT_COMMIT = priorCommit;
  resetStartupStatusForTests();
});
