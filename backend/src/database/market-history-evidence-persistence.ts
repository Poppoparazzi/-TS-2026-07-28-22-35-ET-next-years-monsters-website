// TS: 2026-08-29 17:00 ET

import type { PoolClient } from "pg";
import type { MarketHistoryEvidence } from "../ratings/market-history-evidence.js";

interface MarketHistoryEvidenceRow {
  provider: string;
  usable_bar_count: number;
  latest_bar_date: string | Date | null;
  retrieved_at: string | Date;
  feed_disclosure: string;
}

function assertPersistableMarketHistoryEvidence(
  companyId: string,
  evidence: MarketHistoryEvidence,
): void {
  if (!companyId.trim()) {
    throw new Error("market_history_evidence_company_id_required");
  }
  if (!evidence.provider.trim()) {
    throw new Error("market_history_evidence_provider_required");
  }
  if (!Number.isInteger(evidence.usableBarCount) || evidence.usableBarCount < 0) {
    throw new Error("market_history_evidence_invalid_usable_bar_count");
  }
  const hasUsableBars = evidence.usableBarCount > 0;
  const hasLatestBarDate = evidence.latestBarDate !== null;
  if (hasUsableBars !== hasLatestBarDate || (
    evidence.latestBarDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(evidence.latestBarDate)
  )) {
    throw new Error("market_history_evidence_invalid_latest_bar_date");
  }
  if (!Number.isFinite(Date.parse(evidence.retrievedAt))) {
    throw new Error("market_history_evidence_invalid_retrieved_at");
  }
  if (!evidence.feedDisclosure.trim()) {
    throw new Error("market_history_evidence_disclosure_required");
  }
}

function normalizeDateOnly(value: string | Date | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function normalizeTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function getMarketHistoryEvidence(
  client: Pick<PoolClient, "query">,
  companyId: string,
  provider: string,
  symbol: string,
): Promise<MarketHistoryEvidence | null> {
  if (!companyId.trim()) {
    throw new Error("market_history_evidence_company_id_required");
  }
  if (!provider.trim()) {
    throw new Error("market_history_evidence_provider_required");
  }
  if (!symbol.trim()) {
    throw new Error("market_history_evidence_symbol_required");
  }

  const result = await client.query<MarketHistoryEvidenceRow>(
    `
      SELECT
        provider,
        usable_bar_count,
        latest_bar_date,
        retrieved_at,
        feed_disclosure
      FROM market_history_evidence
      WHERE company_id = $1
        AND provider = $2
      LIMIT 1
    `,
    [companyId, provider],
  );
  const row = result.rows[0];
  if (!row) return null;

  const evidence: MarketHistoryEvidence = {
    symbol: symbol.trim().toUpperCase(),
    provider: row.provider,
    usableBarCount: Number(row.usable_bar_count),
    latestBarDate: normalizeDateOnly(row.latest_bar_date),
    retrievedAt: normalizeTimestamp(row.retrieved_at),
    feedDisclosure: row.feed_disclosure,
  };
  assertPersistableMarketHistoryEvidence(companyId, evidence);
  return evidence;
}

export async function upsertMarketHistoryEvidence(
  client: Pick<PoolClient, "query">,
  companyId: string,
  evidence: MarketHistoryEvidence,
): Promise<void> {
  assertPersistableMarketHistoryEvidence(companyId, evidence);

  await client.query(
    `
      INSERT INTO market_history_evidence (
        company_id,
        provider,
        usable_bar_count,
        latest_bar_date,
        retrieved_at,
        feed_disclosure
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (company_id, provider) DO UPDATE SET
        usable_bar_count = EXCLUDED.usable_bar_count,
        latest_bar_date = EXCLUDED.latest_bar_date,
        retrieved_at = EXCLUDED.retrieved_at,
        feed_disclosure = EXCLUDED.feed_disclosure
      WHERE EXCLUDED.retrieved_at >= market_history_evidence.retrieved_at
    `,
    [
      companyId,
      evidence.provider,
      evidence.usableBarCount,
      evidence.latestBarDate,
      evidence.retrievedAt,
      evidence.feedDisclosure,
    ],
  );
}
