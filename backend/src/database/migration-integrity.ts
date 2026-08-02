// TS: 2026-08-02 15:45 ET

export const PIPELINE_MIGRATION_FILENAME = "999_bulk_company_pipeline_status.sql";

const REQUIRED_PIPELINE_COLUMNS = Object.freeze([
  "company_id",
  "sec_status",
  "quote_status",
  "rating_status",
  "sec_attempt_count",
  "last_error",
  "last_started_at",
  "last_completed_at",
  "next_retry_at",
  "created_at",
  "updated_at",
]);

const REQUIRED_PIPELINE_CONSTRAINTS = Object.freeze([
  "company_pipeline_sec_status_check",
  "company_pipeline_quote_status_check",
  "company_pipeline_rating_status_check",
]);

interface QueryResult<Row> {
  readonly rows: readonly Row[];
  readonly rowCount?: number | null;
}

export interface MigrationIntegrityClient {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

interface PipelineSchemaCheckRow {
  readonly table_exists: boolean;
  readonly columns_complete: boolean;
  readonly constraints_complete: boolean;
  readonly index_exists: boolean;
  readonly trigger_exists: boolean;
}

export async function repairKnownMigrationChecksum(
  client: MigrationIntegrityClient,
  filename: string,
  priorChecksum: string,
  expectedChecksum: string,
): Promise<boolean> {
  if (filename !== PIPELINE_MIGRATION_FILENAME) return false;

  await client.query("BEGIN");

  try {
    const schemaResult = await client.query<PipelineSchemaCheckRow>(
      `
        SELECT
          to_regclass('company_pipeline_status') IS NOT NULL AS table_exists,
          NOT EXISTS (
            SELECT required.column_name
            FROM unnest($1::text[]) AS required(column_name)
            WHERE NOT EXISTS (
              SELECT 1
              FROM information_schema.columns c
              WHERE c.table_schema = current_schema()
                AND c.table_name = 'company_pipeline_status'
                AND c.column_name = required.column_name
            )
          ) AS columns_complete,
          NOT EXISTS (
            SELECT required.constraint_name
            FROM unnest($2::text[]) AS required(constraint_name)
            WHERE NOT EXISTS (
              SELECT 1
              FROM pg_constraint pc
              WHERE pc.conrelid = to_regclass('company_pipeline_status')
                AND pc.conname = required.constraint_name
            )
          ) AS constraints_complete,
          to_regclass('company_pipeline_sec_queue_idx') IS NOT NULL AS index_exists,
          EXISTS (
            SELECT 1
            FROM pg_trigger pt
            WHERE pt.tgrelid = to_regclass('company_pipeline_status')
              AND pt.tgname = 'company_pipeline_status_set_updated_at'
              AND NOT pt.tgisinternal
          ) AS trigger_exists
      `,
      [REQUIRED_PIPELINE_COLUMNS, REQUIRED_PIPELINE_CONSTRAINTS],
    );

    const schema = schemaResult.rows[0];
    const schemaMatches = Boolean(
      schema?.table_exists &&
        schema.columns_complete &&
        schema.constraints_complete &&
        schema.index_exists &&
        schema.trigger_exists,
    );

    if (!schemaMatches) {
      await client.query("ROLLBACK");
      return false;
    }

    const updateResult = await client.query(
      `
        UPDATE schema_migrations
        SET checksum = $1
        WHERE filename = $2
          AND checksum = $3
      `,
      [expectedChecksum, filename, priorChecksum],
    );

    if (updateResult.rowCount !== 1) {
      await client.query("ROLLBACK");
      return false;
    }

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}
