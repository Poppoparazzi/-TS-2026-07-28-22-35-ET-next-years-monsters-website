// TS: 2026-08-02 21:48 ET

import { loadConfig } from "../config.js";
import { runSecUniverseBatch } from "../universe/sec-batch-processor.js";

function argumentValue(arguments_: readonly string[], name: string): string | undefined {
  const inline = arguments_.find((argument) => argument.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);

  const index = arguments_.findIndex((argument) => argument === name);
  return index >= 0 ? arguments_[index + 1] : undefined;
}

function integerArgument(
  arguments_: readonly string[],
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = argumentValue(arguments_, name);
  if (raw === undefined) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

async function run(): Promise<void> {
  const arguments_ = process.argv.slice(2);
  const summary = await runSecUniverseBatch(loadConfig(), {
    batchSize: integerArgument(arguments_, "--limit", 100, 1, 2_500),
    concurrency: integerArgument(arguments_, "--concurrency", 3, 1, 8),
    maxAgeHours: integerArgument(arguments_, "--max-age-hours", 24, 1, 720),
  });

  console.log(JSON.stringify(summary, null, 2));
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown bulk SEC failure.";
  console.error(`Bulk SEC processing failed: ${message}`);
  process.exitCode = 1;
});
