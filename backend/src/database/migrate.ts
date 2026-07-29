// TS: 2026-07-29 16:17 ET

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

interface AppliedMigration {
  readonly filename: string;
  readonly checksum: string;
}

const MIGRATION_LOCK_NAME = "next-years-monsters-database-migrations";
const migrationsDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../database/migrations",
);

function requiredDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const value = environment.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is required to run database migrations.");
  }

  return value;
}

function checksum(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function removeMigrationTransactionWrapper(content: string): string {
  const lines = content.split(/\r?\n/);
  const beginIndex = lines.findIndex((line) => line.trim().toUpperCase() === "BEGIN;");
  const commitIndex = lines.findLastIndex((line) => line.trim().toUpperCase() === "COMMIT;");

  if (beginIndex < 0 || commitIndex < 0 || commitIndex <= beginIndex) {
    throw new Error("Migration must contain a top-level BEGIN; and COMMIT; wrapper.");
  }

  return lines
    .filter((_line, index) => index !== beginIndex && index !== commitIndex)
    .join("\n");
}

async function loadMigrationFiles(): Promise<readonly string[]> {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function ensureMigrationTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function appliedMigrations(client: Client): Promise<Map<string, string>> {
  const result = await client.query<AppliedMigration>(
    "SELECT filename, checksum FROM schema_migrations ORDER BY filename",
  );

  return new Map(result.rows.map((row) => [row.filename, row.checksum]));
}

async function applyMigration(
  client: Client,
  filename: string,
  content: string,
  migrationChecksum: string,
): Promise<void> {
  const migrationSql = removeMigrationTransactionWrapper(content);

  await client.query("BEGIN");

  try {
    await client.query(migrationSql);
    await client.query(
      "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)",
      [filename, migrationChecksum],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function migrate(): Promise<void> {
  const client = new Client({ connectionString: requiredDatabaseUrl() });
  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [MIGRATION_LOCK_NAME]);
    await ensureMigrationTable(client);

    const applied = await appliedMigrations(client);
    const filenames = await loadMigrationFiles();

    if (filenames.length === 0) {
      throw new Error("No database migration files were found.");
    }

    for (const filename of filenames) {
      const path = resolve(migrationsDirectory, filename);
      const content = await readFile(path, "utf8");
      const migrationChecksum = checksum(content);
      const priorChecksum = applied.get(filename);

      if (priorChecksum) {
        if (priorChecksum !== migrationChecksum) {
          throw new Error(
            `Applied migration ${filename} has changed. Add a new migration instead of editing history.`,
          );
        }

        console.log(`SKIP ${filename}`);
        continue;
      }

      await applyMigration(client, filename, content, migrationChecksum);
      console.log(`APPLIED ${filename}`);
    }
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext($1))", [MIGRATION_LOCK_NAME])
      .catch(() => undefined);
    await client.end();
  }
}

migrate().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown migration failure.";
  console.error(`Database migration failed: ${message}`);
  process.exitCode = 1;
});
