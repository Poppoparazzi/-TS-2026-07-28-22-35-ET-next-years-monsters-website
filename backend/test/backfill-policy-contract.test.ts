// TS: 2026-08-19 22:00 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRepositoryFile(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("production reserve policy stays deliberately overfilled and observable", () => {
  const renderYaml = readRepositoryFile("../../render.yaml");
  const serverSource = readRepositoryFile("../src/server.ts");

  assert.match(renderYaml, /key:\s*AUTO_IMPORT_UNIVERSE_LIMIT[\s\S]*?value:\s*"5000"/);
  assert.match(renderYaml, /key:\s*AUTO_SEC_BATCH_SIZE[\s\S]*?value:\s*"5000"/);
  assert.match(renderYaml, /key:\s*SEC_USABLE_TARGET[\s\S]*?value:\s*"2200"/);
  assert.match(renderYaml, /key:\s*SEC_BATCH_CONCURRENCY[\s\S]*?value:\s*"8"/);
  assert.match(renderYaml, /key:\s*SEC_BATCH_MAX_AGE_HOURS[\s\S]*?value:\s*"720"/);

  assert.match(serverSource, /candidateTarget:\s*safeEnvironmentInteger\("AUTO_IMPORT_UNIVERSE_LIMIT"\)/);
  assert.match(serverSource, /secBatchSize:\s*safeEnvironmentInteger\("AUTO_SEC_BATCH_SIZE"\)/);
  assert.match(serverSource, /usableTarget:\s*safeEnvironmentInteger\("SEC_USABLE_TARGET"\)/);
  assert.match(serverSource, /concurrency:\s*safeEnvironmentInteger\("SEC_BATCH_CONCURRENCY"\)/);
  assert.match(serverSource, /maxAgeHours:\s*safeEnvironmentInteger\("SEC_BATCH_MAX_AGE_HOURS"\)/);

  const candidateTarget = Number(renderYaml.match(/key:\s*AUTO_IMPORT_UNIVERSE_LIMIT[\s\S]*?value:\s*"(\d+)"/)?.[1]);
  const usableTarget = Number(renderYaml.match(/key:\s*SEC_USABLE_TARGET[\s\S]*?value:\s*"(\d+)"/)?.[1]);

  assert.ok(candidateTarget >= 5000, "candidate target must preserve the 5,000-stock reserve strategy");
  assert.ok(usableTarget > 2000, "usable target must retain a cushion above 2,000");
  assert.ok(candidateTarget > usableTarget, "candidate pool must remain larger than the usable-stock target");
});
