// TS: 2026-08-17 16:00 ET

const apiBaseUrl = (process.env.NYM_API_BASE_URL || "https://next-years-monsters-api.onrender.com")
  .trim()
  .replace(/\/$/, "");
const candidateTarget = Number(process.env.NYM_CANDIDATE_TARGET || "2500");
const usableTarget = Number(process.env.NYM_USABLE_TARGET || "2000");

const mustResolve = new Set([
  "AAPL", "NVDA", "MNST", "AMZN", "TSLA", "NFLX", "AMD", "COST", "VRT", "AXON",
  "DECK", "WING", "META", "APP", "MSFT", "GOOGL", "GOOG", "AVGO", "PLTR", "CRDO",
  "RKLB", "QCOM", "MU", "ARM", "DELL", "INTC", "MRVL", "HOOD", "COIN", "UBER",
]);

function asNonnegativeInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name}=${String(value)} is not a nonnegative integer.`);
  }
  return parsed;
}

function roundedPercent(numerator, denominator) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10_000) / 100;
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
const examinedCount = asNonnegativeInteger(status.examinedCount, "examinedCount");
const secCompleteCount = asNonnegativeInteger(status.secCompleteCount, "secCompleteCount");
const unresolvedCount = asNonnegativeInteger(status.unresolvedCount, "unresolvedCount");
const failedCount = asNonnegativeInteger(status.failedCount, "failedCount");
const usableShortfall = Math.max(usableTarget - secCompleteCount, 0);
const candidateHeadroom = Math.max(candidateTarget - examinedCount, 0);
const observedSecCompletionRatePercent = roundedPercent(secCompleteCount, examinedCount);
const minimumRemainingSuccessRatePercent =
  usableShortfall === 0 ? 0 : roundedPercent(usableShortfall, candidateHeadroom);
const reserveCapacityAdequate = usableShortfall === 0 || candidateHeadroom >= usableShortfall;
const reserveCapacityMargin = candidateHeadroom - usableShortfall;

const companies = Array.isArray(status.companies) ? status.companies : [];
const unresolved = companies.filter((company) => company?.secStage === "unresolved");
const failed = companies.filter((company) => company?.secStage === "failed");
const mustFix = [...unresolved, ...failed]
  .filter((company) => mustResolve.has(String(company?.ticker || "").toUpperCase()))
  .map((company) => ({
    ticker: company.ticker,
    companyName: company.companyName,
    secStage: company.secStage,
    lastError: company.lastError ?? null,
  }));
const replaceableVisible = [...unresolved, ...failed]
  .filter((company) => !mustResolve.has(String(company?.ticker || "").toUpperCase()))
  .map((company) => company.ticker);

const report = {
  generatedAt: new Date().toISOString(),
  candidateTarget,
  usableTarget,
  universeSize: status.universeSize,
  examinedCount,
  secCompleteCount,
  unresolvedCount,
  failedCount,
  usableShortfall,
  candidateHeadroom,
  observedSecCompletionRatePercent,
  minimumRemainingSuccessRatePercent,
  reserveCapacityAdequate,
  reserveCapacityMargin,
  targetSatisfied: secCompleteCount >= usableTarget,
  mustFixCount: mustFix.length,
  mustFix,
  replaceableVisibleCount: replaceableVisible.length,
  replaceableVisible,
  note:
    examinedCount < candidateTarget
      ? reserveCapacityAdequate
        ? `Production has ${candidateHeadroom} unused candidate slots for a ${usableShortfall}-stock SEC-complete shortfall. The remaining reserve only needs a ${minimumRemainingSuccessRatePercent}% SEC-completion rate to reach ${usableTarget}.`
        : `Production does not have enough remaining candidate slots to cover the ${usableShortfall}-stock shortfall even if every remaining candidate resolves. Expand the candidate target.`
      : secCompleteCount >= usableTarget
        ? `Production has at least ${usableTarget} SEC-complete companies; unresolved lower-priority names no longer block the active target.`
        : `The current candidate pool is exhausted and still needs ${usableShortfall} SEC-complete companies. Expand the candidate target rather than retrying unchanged lower-priority unresolved names.`,
};

console.log("Next Year's Monsters reserve/backfill report:");
console.log(JSON.stringify(report, null, 2));
