// TS: 2026-08-02 15:47 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  PIPELINE_MIGRATION_FILENAME,
  repairKnownMigrationChecksum,
  type MigrationIntegrityClient,
} from "../src/database/migration-integrity.js";

interface QueryCall {
  readonly text: string;
  readonly values?: readonly unknown[];
}

class FakeIntegrityClient implements MigrationIntegrityClient {
  public readonly calls: QueryCall[] = [];
  public schemaMatches = true;
  public updateRowCount = 1;

  public async query<Row = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: readonly Row[]; rowCount?: number | null }> {
    this.calls.push({ text, values });

    if (text.includes("table_exists")) {
      return {
        rows: [
          {
            table_exists: this.schemaMatches,
            columns_complete: this.schemaMatches,
            constraints_complete: this.schemaMatches,
            index_exists: this.schemaMatches,
            trigger_exists: this.schemaMatches,
          } as Row,
        ],
      };
    }

    if (text.includes("UPDATE schema_migrations")) {
      return { rows: [], rowCount: this.updateRowCount };
    }

    return { rows: [] };
  }
}

test("checksum repair rejects every migration except the known pipeline migration", async () => {
  const client = new FakeIntegrityClient();
  const repaired = await repairKnownMigrationChecksum(
    client,
    "001_initial_schema.sql",
    "old",
    "new",
  );

  assert.equal(repaired, false);
  assert.equal(client.calls.length, 0);
});

test("checksum repair updates only after the pipeline schema is verified", async () => {
  const client = new FakeIntegrityClient();
  const repaired = await repairKnownMigrationChecksum(
    client,
    PIPELINE_MIGRATION_FILENAME,
    "old-checksum",
    "new-checksum",
  );

  assert.equal(repaired, true);
  assert.equal(client.calls[0]?.text, "BEGIN");
  assert.match(client.calls[1]?.text ?? "", /company_pipeline_status/);
  assert.match(client.calls[2]?.text ?? "", /UPDATE schema_migrations/);
  assert.deepEqual(client.calls[2]?.values, [
    "new-checksum",
    PIPELINE_MIGRATION_FILENAME,
    "old-checksum",
  ]);
  assert.equal(client.calls.at(-1)?.text, "COMMIT");
});

test("checksum repair refuses an incomplete pipeline schema", async () => {
  const client = new FakeIntegrityClient();
  client.schemaMatches = false;

  const repaired = await repairKnownMigrationChecksum(
    client,
    PIPELINE_MIGRATION_FILENAME,
    "old-checksum",
    "new-checksum",
  );

  assert.equal(repaired, false);
  assert.equal(client.calls.some((call) => call.text.includes("UPDATE schema_migrations")), false);
  assert.equal(client.calls.at(-1)?.text, "ROLLBACK");
});

test("checksum repair requires an exact prior-checksum row match", async () => {
  const client = new FakeIntegrityClient();
  client.updateRowCount = 0;

  const repaired = await repairKnownMigrationChecksum(
    client,
    PIPELINE_MIGRATION_FILENAME,
    "unexpected-old-checksum",
    "new-checksum",
  );

  assert.equal(repaired, false);
  assert.equal(client.calls.at(-1)?.text, "ROLLBACK");
});
