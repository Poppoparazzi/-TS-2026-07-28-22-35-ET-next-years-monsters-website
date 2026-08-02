// TS: 2026-08-02 14:29 ET

import { loadConfig } from "../config.js";
import { loadSecUniverse } from "../universe/sec-source.js";
import { createUniverseStore } from "../universe/store.js";

function parseLimit(arguments_: readonly string[]): number {
  const inline = arguments_.find((argument) => argument.startsWith("--limit="));
  const inlineValue = inline?.slice("--limit=".length);
  const separateIndex = arguments_.findIndex((argument) => argument === "--limit");
  const separateValue = separateIndex >= 0 ? arguments_[separateIndex + 1] : undefined;
  const requested = Number(inlineValue ?? separateValue ?? "100");

  if (!Number.isInteger(requested) || requested < 1 || requested > 5_000) {
    throw new Error("Universe import limit must be an integer from 1 to 5000.");
  }

  return requested;
}

async function run(): Promise<void> {
  const config = loadConfig();
  const limit = parseLimit(process.argv.slice(2));

  if (!config.secUserAgent) {
    throw new Error("SEC_USER_AGENT is required to import the official ticker universe.");
  }
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required to save the ticker universe.");
  }

  const store = createUniverseStore(config);

  try {
    const companies = await loadSecUniverse(config.secUserAgent, limit);
    const imported = await store.importCompanies(companies);
    const status = await store.getStatus(limit);

    console.log(
      JSON.stringify(
        {
          import: imported,
          status: {
            universeSize: status.universeSize,
            examinedCount: status.examinedCount,
            secIdentityCount: status.secIdentityCount,
            filingCompleteCount: status.filingCompleteCount,
            factsCompleteCount: status.factsCompleteCount,
            quoteCompleteCount: status.quoteCompleteCount,
            ratingCompleteCount: status.ratingCompleteCount,
            fullyCompleteCount: status.fullyCompleteCount,
            incompleteCount: status.incompleteCount,
            generatedAt: status.generatedAt,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await store.close();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown universe import failure.";
  console.error(`SEC universe import failed: ${message}`);
  process.exitCode = 1;
});
