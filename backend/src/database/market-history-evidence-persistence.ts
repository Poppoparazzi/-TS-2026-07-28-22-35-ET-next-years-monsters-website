// TS: 2026-08-28 10:57 ET

import type { PoolClient } from "pg";
import type { MarketHistoryEvidence } from "../ratings/market-history-evidence.js";

export async function upsertMarketHistoryEvidence(
  client: Pick<PoolClient, "query">,
  companyId: string,
  evidence: MarketHistoryEvidence,
): Promise<void> {
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
