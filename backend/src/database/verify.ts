// TS: 2026-08-01 21:06 ET

import pg from "pg";

const { Client } = pg;

const REQUIRED_RELATIONS = Object.freeze([
  "schema_migrations",
  "company_live_readiness",
  "pilot_live_gate",
  "top_25_live_gate",
]);

function requiredDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const value = environment.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is required to verify the production database.");
  }

  return value;
}

async function verifyDatabase(): Promise<void> {
  const client = new Client({
    connectionString: requiredDatabaseUrl(),
    connectionTimeoutMillis: 10_000,
  });

  await client.connect();

  try {
    const relationResult = await client.query<{
      relation_name: string;
      relation_oid: string | null;
    }>(
      `
        SELECT
          requested.relation_name,
          to_regclass(requested.relation_name) AS relation_oid
        FROM unnest($1::text[]) AS requested(relation_name)
        ORDER BY requested.relation_name
      `,
      [REQUIRED_RELATIONS],
    );

    const missingRelations = relationResult.rows
      .filter((row) => row.relation_oid === null)
      .map((row) => row.relation_name);

    if (missingRelations.length > 0) {
      throw new Error(`Missing required database relations: ${missingRelations.join(", ")}`);
    }

    const migrationResult = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM schema_migrations",
    );
    const migrationCount = Number(migrationResult.rows[0]?.count ?? 0);

    if (!Number.isFinite(migrationCount) || migrationCount < 1) {
      throw new Error("No applied database migrations were recorded.");
    }

    await Promise.all([
      client.query("SELECT count(*) FROM company_live_readiness"),
      client.query("SELECT count(*) FROM pilot_live_gate"),
      client.query("SELECT count(*) FROM top_25_live_gate"),
    ]);

    console.log(
      `Database verification passed: ${migrationCount} migration(s), ${REQUIRED_RELATIONS.length} required relations.`,
    );
  } finally {
    await client.end();
  }
}

verifyDatabase().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown database verification failure.";
  console.error(`Database verification failed: ${message}`);
  process.exitCode = 1;
});
