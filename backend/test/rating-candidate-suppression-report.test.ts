// TS: 2026-09-06 01:10 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  RATING_CANDIDATE_SUPPRESSION_REPORT_SQL,
  RATING_PERSISTED_SUPPRESSION_REASON_REPORT_SQL,
  RATING_RECENT_FAILURE_REASON_REPORT_SQL,
} from "../src/jobs/report-rating-candidate-suppression.js";

test("candidate suppression report separates history and durable liquidity suppression partitions", () => {
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /market_history_evidence_latest/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /rating_history_ready\s*=\s*false/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /suppression_reason\s*=\s*'insufficient_liquidity'/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /INTERVAL\s+'30 days'/i);
  assert.doesNotMatch(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /INTERVAL\s+'7 days'/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /EXTRACT\(ISODOW/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /BETWEEN\s+1\s+AND\s+5/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /cooldown_suppressed_count/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /session_gap_suppressed_count/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /retry_eligible_count/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /total_known_insufficient_count/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /durable_liquidity_suppressed_count/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /durable_liquidity_retry_eligible_count/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /total_known_liquidity_suppression_count/i);
  assert.doesNotMatch(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /\b(?:update|delete|insert|alter|drop|truncate)\b/i);
});

test("persisted suppression report classifies every latest ineligible market-history reason", () => {
  assert.match(RATING_PERSISTED_SUPPRESSION_REASON_REPORT_SQL, /market_history_evidence_latest/i);
  assert.match(RATING_PERSISTED_SUPPRESSION_REASON_REPORT_SQL, /rating_history_ready\s*=\s*false/i);
  assert.match(RATING_PERSISTED_SUPPRESSION_REASON_REPORT_SQL, /suppression_reason/i);
  assert.match(RATING_PERSISTED_SUPPRESSION_REASON_REPORT_SQL, /COALESCE\(NULLIF\(suppression_reason,\s*''\),\s*'unclassified'\)/i);
  assert.match(RATING_PERSISTED_SUPPRESSION_REASON_REPORT_SQL, /GROUP\s+BY\s+reason_code/i);
  assert.match(RATING_PERSISTED_SUPPRESSION_REASON_REPORT_SQL, /total_persisted_suppressed_count/i);
  assert.match(RATING_PERSISTED_SUPPRESSION_REASON_REPORT_SQL, /persisted_market_history/i);
  assert.match(RATING_PERSISTED_SUPPRESSION_REASON_REPORT_SQL, /reason_breakdown/i);
  assert.doesNotMatch(RATING_PERSISTED_SUPPRESSION_REASON_REPORT_SQL, /\b(?:update|delete|insert|alter|drop|truncate)\b/i);
});

test("recent failure report counts unique candidates by their latest machine-readable reason", () => {
  assert.match(RATING_RECENT_FAILURE_REASON_REPORT_SQL, /data_refresh_runs/i);
  assert.match(RATING_RECENT_FAILURE_REASON_REPORT_SQL, /metadata\s*->\s*'replaceable'/i);
  assert.match(RATING_RECENT_FAILURE_REASON_REPORT_SQL, /reasonCode/i);
  assert.match(RATING_RECENT_FAILURE_REASON_REPORT_SQL, /suppressionStage/i);
  assert.match(RATING_RECENT_FAILURE_REASON_REPORT_SQL, /legacy_unclassified/i);
  assert.match(RATING_RECENT_FAILURE_REASON_REPORT_SQL, /INTERVAL\s+'30 days'/i);
  assert.doesNotMatch(RATING_RECENT_FAILURE_REASON_REPORT_SQL, /INTERVAL\s+'7 days'/i);
  assert.match(RATING_RECENT_FAILURE_REASON_REPORT_SQL, /DISTINCT\s+ON\s*\(ticker\)/i);
  assert.match(RATING_RECENT_FAILURE_REASON_REPORT_SQL, /ORDER\s+BY\s+ticker,\s*started_at\s+DESC/i);
  assert.match(RATING_RECENT_FAILURE_REASON_REPORT_SQL, /total_recent_replaceable_count/i);
  assert.match(RATING_RECENT_FAILURE_REASON_REPORT_SQL, /total_recent_replaceable_event_count/i);
  assert.match(RATING_RECENT_FAILURE_REASON_REPORT_SQL, /reason_breakdown/i);
  assert.doesNotMatch(RATING_RECENT_FAILURE_REASON_REPORT_SQL, /\b(?:update|delete|insert|alter|drop|truncate)\b/i);
});
