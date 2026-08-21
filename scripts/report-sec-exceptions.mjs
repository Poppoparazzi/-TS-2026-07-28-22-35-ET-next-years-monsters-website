// TS: 2026-08-21 04:01 ET

import fs from "node:fs";
import { isProtectedStock } from "./protected-stocks.mjs";

const apiBaseUrl = (process.env.NYM_API_BASE_URL || "https://next-years-monsters-api.onrender.com")
  .trim()
  .replace(/\/$/, "");
const candidateTarget = Number(process.env.NYM_CANDIDATE_TARGET || "5000");
const usableTarget = Number(process.env.NYM_USABLE_TARGET || "2200");
const exceptionStateFile = (process.env.NYM_SEC_EXCEPTION_STATE_FILE || "nym-sec-exceptions.json").trim();

if (!Number.isInteger(candidateTarget) || candidateTarget < 1 || candidateTarget > 5000) {
  throw new Error("NYM_CANDIDATE_TARGET must be an integer from 1 to 5000.");
}
if (!Number.isInteger(usableTarget) || usableTarget < 1 || usableTarget > candidateTarget) {
  throw new Error("NYM_USABLE_TARGET must be an integer from 1 through NYM_CANDIDATE_TARGET.");
}
if (!exceptionStateFile) {
  throw new Error("NYM_SEC_EXCEPTION_STATE_FILE must not be empty.");
}

function reasonBucket(company) {
  const message = String(company?.lastError || "").toLowerCase();
  const ticker = String(company?.ticker || "").toUpperCase();
  const exchange = String(company?.exchange || "unknown").toUpperCase();

  if (message.includes("companies_sec_cik_unique") || message.includes("duplicate") && message.includes("cik")) {
    return "duplicate_cik";
  }
  if (message.includes("404") || message.includes("not found") || message.includes("no sec")) {
    return "sec_not_found";
  }
  if (message.includes("timeout") || message.includes("timed out") || message.includes("429") || message.includes("rate limit")) {
    return "transient_sec_transport";
  }
  if (message.includes("mismatch") || message.includes("ambiguous") || message.includes("multiple")) {
    return "identity_ambiguous";
  }
  if (exchange === "OTC" || exchange.includes("OTC")) {
    return "otc_or_foreign_style";
  }
  if (ticker.endsWith("Y") || ticker.endsWith("F")) {
    return "adr_or_foreign_style";
  }
  return message ? "other_error" : "no_error_detail";
}

function replacementPriority(company) {
  const reason = reasonBucket(company);
  const priorities = {
    duplicate_cik: 10,
    sec_not_found: 20,
    identity_ambiguous: 30,
    otc_or_foreign_style: 40,
    adr_or_foreign_style: 50,
    other_error: 60,
    no_error_detail: 70,
    transient_sec_transport: 90,
  };
  return priorities[reason] ?? 80;
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

async function requestJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(70_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}: ${payload?.message || payload?.error || "no JSON error"}`);
  }
  return payload;
}

const status = await requestJson(`${apiBaseUrl}/api/universe/status?limit=${candidateTarget}`);
const companies = Array.isArray(status?.companies) ? status.companies : [];
const unresolvedCount = Number(status?.unresolvedCount || 0);
const failedCount = Number(status?.failedCount || 0);
const secEvidenceReadyCount = Number(status?.secEvidenceReadyCount || 0);
const evidenceReadyShortfall = Math.max(usableTarget - secEvidenceReadyCount, 0);
const expectedExceptionCount = unresolvedCount + failedCount;
const exceptions = companies.filter((company) => company?.secStage === "unresolved" || company?.secStage === "failed");
const exceptionVisibilityComplete = exceptions.length === expectedExceptionCount;

if (!exceptionVisibilityComplete) {
  throw new Error(
    `SEC exception classification is incomplete: API reports ${expectedExceptionCount} unresolved/failed records, ` +
      `but only ${exceptions.length} are visible in the returned company list. Refusing to classify a partial exception set.`,
  );
}

const protectedExceptions = exceptions.filter(isProtectedStock);
const replaceableExceptions = exceptions.filter((company) => !isProtectedStock(company));
const prioritizedReplaceableExceptions = [...replaceableExceptions].sort((a, b) => {
  const priorityDifference = replacementPriority(a) - replacementPriority(b);
  if (priorityDifference !== 0) return priorityDifference;
  const attemptDifference = Number(b?.secAttemptCount || 0) - Number(a?.secAttemptCount || 0);
  if (attemptDifference !== 0) return attemptDifference;
  return String(a?.ticker || "").localeCompare(String(b?.ticker || ""));
});
const failedExceptions = exceptions.filter((company) => company?.secStage === "failed");
const unresolvedExceptions = exceptions.filter((company) => company?.secStage === "unresolved");
const protectedFailedExceptions = failedExceptions.filter(isProtectedStock);
const replaceableFailedExceptions = failedExceptions.filter((company) => !isProtectedStock(company));
const protectedUnresolvedExceptions = unresolvedExceptions.filter(isProtectedStock);
const replaceableUnresolvedExceptions = unresolvedExceptions.filter((company) => !isProtectedStock(company));

const byReason = new Map();
const byExchange = new Map();
for (const company of exceptions) {
  increment(byReason, reasonBucket(company));
  increment(byExchange, String(company?.exchange || "unknown").toUpperCase());
}

const exactExceptionRoster = exceptions.map((company) => ({
  ticker: company.ticker,
  companyName: company.companyName,
  exchange: company.exchange ?? null,
  secStage: company.secStage,
  protected: isProtectedStock(company),
  disposition: isProtectedStock(company) ? "must_repair" : "replaceable",
  reason: reasonBucket(company),
  replacementPriority: isProtectedStock(company) ? null : replacementPriority(company),
  secAttemptCount: Number(company.secAttemptCount || 0),
  lastError: company.lastError ?? null,
}));

const replacementQueue = prioritizedReplaceableExceptions.map((company, index) => ({
  order: index + 1,
  ticker: company.ticker,
  companyName: company.companyName,
  exchange: company.exchange ?? null,
  secStage: company.secStage,
  reason: reasonBucket(company),
  replacementPriority: replacementPriority(company),
  secAttemptCount: Number(company.secAttemptCount || 0),
  lastError: company.lastError ?? null,
}));

const recommendedAction = evidenceReadyShortfall === 0
  ? protectedExceptions.length > 0 || failedCount > 0
    ? "repair_protected_and_clear_failed_rows"
    : "usable_target_satisfied"
  : replaceableExceptions.length > 0
    ? "backfill_from_reserve_and_replace_low_priority_exceptions"
    : protectedExceptions.length > 0
      ? "repair_protected_exceptions_while_expanding_reserve"
      : "expand_reserve_pool";

const report = {
  generatedAt: new Date().toISOString(),
  candidateTarget,
  usableTarget,
  examinedCount: Number(status?.examinedCount || 0),
  secCompleteCount: Number(status?.secCompleteCount || 0),
  secEvidenceReadyCount,
  evidenceReadyShortfall,
  unresolvedCount,
  failedCount,
  expectedExceptionCount,
  exceptionCountVisible: exceptions.length,
  exceptionVisibilityComplete,
  protectedExceptionCount: protectedExceptions.length,
  protectedExceptions: protectedExceptions.map((company) => ({
    ticker: company.ticker,
    companyName: company.companyName,
    exchange: company.exchange ?? null,
    secStage: company.secStage,
    reason: reasonBucket(company),
    lastError: company.lastError ?? null,
  })),
  replaceableExceptionCount: replaceableExceptions.length,
  recommendedAction,
  replacementQueue,
  failedDecision: {
    total: failedExceptions.length,
    mustRepair: protectedFailedExceptions.length,
    replaceable: replaceableFailedExceptions.length,
    allFailedAreReplaceable: failedExceptions.length > 0 && protectedFailedExceptions.length === 0,
    mustRepairTickers: protectedFailedExceptions.map((company) => company.ticker),
    replaceableTickers: replaceableFailedExceptions.map((company) => company.ticker),
  },
  unresolvedDecision: {
    total: unresolvedExceptions.length,
    mustRepair: protectedUnresolvedExceptions.length,
    replaceable: replaceableUnresolvedExceptions.length,
  },
  reasonBuckets: Object.fromEntries([...byReason.entries()].sort((a, b) => b[1] - a[1])),
  exchangeBuckets: Object.fromEntries([...byExchange.entries()].sort((a, b) => b[1] - a[1])),
  exactExceptionRoster,
  sampleReplaceable: prioritizedReplaceableExceptions.slice(0, 50).map((company) => ({
    ticker: company.ticker,
    companyName: company.companyName,
    exchange: company.exchange ?? null,
    secStage: company.secStage,
    reason: reasonBucket(company),
    replacementPriority: replacementPriority(company),
    lastError: company.lastError ?? null,
  })),
};

fs.writeFileSync(exceptionStateFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `exception_state_file=${exceptionStateFile}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `protected_exception_count=${protectedExceptions.length}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `replaceable_exception_count=${replaceableExceptions.length}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `protected_failed_count=${protectedFailedExceptions.length}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `replaceable_failed_count=${replaceableFailedExceptions.length}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `evidence_ready_shortfall=${evidenceReadyShortfall}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `recommended_action=${recommendedAction}\n`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const protectedSummary = protectedExceptions.length > 0
    ? protectedExceptions.map((company) => `${company.ticker} (${reasonBucket(company)})`).join(", ")
    : "none";
  const topReasons = [...byReason.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => `${reason}: ${count}`)
    .join(", ") || "none";
  const replaceableSample = prioritizedReplaceableExceptions
    .slice(0, 20)
    .map((company) => `${company.ticker} (${reasonBucket(company)}, p${replacementPriority(company)})`)
    .join(", ") || "none";
  const failedRepairSummary = protectedFailedExceptions.length > 0
    ? protectedFailedExceptions.map((company) => company.ticker).join(", ")
    : "none";
  const failedReplaceSummary = replaceableFailedExceptions.length > 0
    ? replaceableFailedExceptions.map((company) => company.ticker).join(", ")
    : "none";

  fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      "### SEC exception roster",
      "",
      `- Evidence-ready stocks: **${secEvidenceReadyCount} / ${usableTarget}**`,
      `- Evidence-ready shortfall: **${evidenceReadyShortfall}**`,
      `- Visible unresolved/failed records: **${exceptions.length}**`,
      `- Must repair: **${protectedExceptions.length}**`,
      `- Replaceable: **${replaceableExceptions.length}**`,
      `- Recommended action: **${recommendedAction}**`,
      `- Failed rows requiring repair: **${protectedFailedExceptions.length}** (${failedRepairSummary})`,
      `- Failed rows safe to replace: **${replaceableFailedExceptions.length}** (${failedReplaceSummary})`,
      `- Protected tickers requiring repair: ${protectedSummary}`,
      `- Top exception reasons: ${topReasons}`,
      `- Prioritized replaceable sample: ${replaceableSample}`,
      `- Exact roster file: \`${exceptionStateFile}\``,
      "",
    ].join("\n"),
  );
}

console.log("Next Year's Monsters SEC exception classification:");
console.log(JSON.stringify(report, null, 2));
console.log(`Persisted exact SEC exception roster to ${exceptionStateFile}.`);
