// TS: 2026-08-20 07:00 ET

const apiBaseUrl = (process.env.NYM_API_BASE_URL || "https://next-years-monsters-api.onrender.com")
  .trim()
  .replace(/\/$/, "");
const candidateTarget = Number(process.env.NYM_CANDIDATE_TARGET || "5000");
const usableTarget = Number(process.env.NYM_USABLE_TARGET || "2200");
const maximumCandidateTarget = 5_000;

function validateTargets() {
  if (!Number.isInteger(candidateTarget) || candidateTarget < 1 || candidateTarget > maximumCandidateTarget) {
    throw new Error(`NYM_CANDIDATE_TARGET=${String(candidateTarget)} must be an integer from 1 to ${maximumCandidateTarget}.`);
  }
  if (!Number.isInteger(usableTarget) || usableTarget < 1 || usableTarget > candidateTarget) {
    throw new Error(
      `NYM_USABLE_TARGET=${String(usableTarget)} must be an integer from 1 to NYM_CANDIDATE_TARGET (${candidateTarget}).`,
    );
  }
}

validateTargets();

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

function roundUp(value, increment) {
  return Math.ceil(value / increment) * increment;
}

function isProtectedCompany(company) {
  const ticker = String(company?.ticker || "").toUpperCase();
  return company?.isPilot === true || mustResolve.has(ticker);
}

function isSecEvidenceReady(company) {
  return (
    company?.secStage === "complete" &&
    company?.hasSecIdentity === true &&
    company?.hasFilings === true &&
    company?.hasFacts === true
  );
}

function exceptionReason(company) {
  const message = String(company?.lastError || "").toLowerCase();
  const ticker = String(company?.ticker || "").toUpperCase();
  const exchange = String(company?.exchange || "unknown").toUpperCase();

  if (message.includes("companies_sec_cik_unique") || (message.includes("duplicate") && message.includes("cik"))) {
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
  if (exchange.includes("OTC")) {
    return "otc_or_foreign_style";
  }
  if (ticker.endsWith("Y") || ticker.endsWith("F")) {
    return "adr_or_foreign_style";
  }
  return message ? "other_error" : "no_error_detail";
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
const universeSize = asNonnegativeInteger(status.universeSize, "universeSize");
const examinedCount = asNonnegativeInteger(status.examinedCount, "examinedCount");
const secCompleteCount = asNonnegativeInteger(status.secCompleteCount, "secCompleteCount");
const unresolvedCount = asNonnegativeInteger(status.unresolvedCount, "unresolvedCount");
const failedCount = asNonnegativeInteger(status.failedCount, "failedCount");
const companies = Array.isArray(status.companies) ? status.companies : [];
const secEvidenceReadyCount = companies.filter(isSecEvidenceReady).length;
const usableShortfall = Math.max(usableTarget - secEvidenceReadyCount, 0);
const preparedCandidateHeadroom = Math.max(candidateTarget - examinedCount, 0);
const loadedCandidateHeadroom = Math.max(Math.min(universeSize, candidateTarget) - examinedCount, 0);
const candidateImportShortfall = Math.max(candidateTarget - universeSize, 0);
const candidateTargetLoaded = candidateImportShortfall === 0;
const observedSecCompletionRate = examinedCount > 0 ? secEvidenceReadyCount / examinedCount : 0;
const observedSecCompletionRatePercent = roundedPercent(secEvidenceReadyCount, examinedCount);
const minimumLoadedSuccessRatePercent =
  usableShortfall === 0 ? 0 : roundedPercent(usableShortfall, loadedCandidateHeadroom);
const minimumPreparedSuccessRatePercent =
  usableShortfall === 0 ? 0 : roundedPercent(usableShortfall, preparedCandidateHeadroom);
const loadedReserveCapacityAdequate = usableShortfall === 0 || loadedCandidateHeadroom >= usableShortfall;
const preparedReserveCapacityAdequate = usableShortfall === 0 || preparedCandidateHeadroom >= usableShortfall;
const loadedReserveCapacityMargin = loadedCandidateHeadroom - usableShortfall;
const preparedReserveCapacityMargin = preparedCandidateHeadroom - usableShortfall;
const projectedSecCompleteAtCandidateTarget = Math.min(
  candidateTarget,
  secEvidenceReadyCount + Math.floor(preparedCandidateHeadroom * observedSecCompletionRate),
);
const projectedUsableSurplusAtCandidateTarget = projectedSecCompleteAtCandidateTarget - usableTarget;
const estimatedAdditionalCandidatesNeededAtObservedRate =
  usableShortfall === 0
    ? 0
    : observedSecCompletionRate > 0
      ? Math.ceil(usableShortfall / observedSecCompletionRate)
      : null;
const estimatedTotalCandidatesNeededAtObservedRate =
  estimatedAdditionalCandidatesNeededAtObservedRate === null
    ? null
    : examinedCount + estimatedAdditionalCandidatesNeededAtObservedRate;
const observedRateProjectsTargetSuccess = projectedSecCompleteAtCandidateTarget >= usableTarget;
const secCountTargetSatisfied = secEvidenceReadyCount >= usableTarget;
const candidatePoolExhausted = examinedCount >= candidateTarget;

const recommendedCandidateTarget = (() => {
  if (secCountTargetSatisfied || observedRateProjectsTargetSuccess) return candidateTarget;
  const rateBasedTarget = estimatedTotalCandidatesNeededAtObservedRate === null
    ? candidateTarget + 500
    : estimatedTotalCandidatesNeededAtObservedRate + 250;
  return Math.min(maximumCandidateTarget, Math.max(candidateTarget + 500, roundUp(rateBasedTarget, 100)));
})();
const expansionRecommended = recommendedCandidateTarget > candidateTarget;
const expansionCeilingReached =
  !secCountTargetSatisfied && recommendedCandidateTarget === maximumCandidateTarget && candidateTarget === maximumCandidateTarget;

const unresolved = companies.filter((company) => company?.secStage === "unresolved");
const failed = companies.filter((company) => company?.secStage === "failed");
const exceptions = [...unresolved, ...failed];

const mustFix = companies
  .filter((company) => isProtectedCompany(company) && !isSecEvidenceReady(company))
  .map((company) => ({
    ticker: company.ticker,
    companyName: company.companyName,
    secStage: company.secStage,
    isPilot: company.isPilot === true,
    hasSecIdentity: company.hasSecIdentity === true,
    hasFilings: company.hasFilings === true,
    hasFacts: company.hasFacts === true,
    reason: exceptionReason(company),
    lastError: company.lastError ?? null,
  }));
const replaceableCompanies = exceptions.filter((company) => !isProtectedCompany(company));
const replaceableVisible = replaceableCompanies.map((company) => company.ticker);
const targetSatisfied = secCountTargetSatisfied && mustFix.length === 0 && failedCount === 0;

const exceptionReasonBuckets = new Map();
const exceptionExchangeBuckets = new Map();
for (const company of exceptions) {
  increment(exceptionReasonBuckets, exceptionReason(company));
  increment(exceptionExchangeBuckets, String(company?.exchange || "unknown").toUpperCase());
}

const report = {
  generatedAt: new Date().toISOString(),
  candidateTarget,
  usableTarget,
  maximumCandidateTarget,
  universeSize,
  candidateTargetLoaded,
  candidateImportShortfall,
  examinedCount,
  secCompleteCount,
  secEvidenceReadyCount,
  unresolvedCount,
  failedCount,
  usableShortfall,
  preparedCandidateHeadroom,
  loadedCandidateHeadroom,
  observedSecCompletionRatePercent,
  minimumLoadedSuccessRatePercent,
  minimumPreparedSuccessRatePercent,
  estimatedAdditionalCandidatesNeededAtObservedRate,
  estimatedTotalCandidatesNeededAtObservedRate,
  projectedSecCompleteAtCandidateTarget,
  projectedUsableSurplusAtCandidateTarget,
  observedRateProjectsTargetSuccess,
  loadedReserveCapacityAdequate,
  preparedReserveCapacityAdequate,
  loadedReserveCapacityMargin,
  preparedReserveCapacityMargin,
  candidatePoolExhausted,
  secCountTargetSatisfied,
  targetSatisfied,
  expansionRecommended,
  recommendedCandidateTarget,
  expansionCeilingReached,
  mustFixCount: mustFix.length,
  mustFix,
  replaceableVisibleCount: replaceableVisible.length,
  replaceableVisible,
  exceptionReasonBuckets: Object.fromEntries([...exceptionReasonBuckets.entries()].sort((a, b) => b[1] - a[1])),
  exceptionExchangeBuckets: Object.fromEntries([...exceptionExchangeBuckets.entries()].sort((a, b) => b[1] - a[1])),
  sampleReplaceable: replaceableCompanies.slice(0, 50).map((company) => ({
    ticker: company.ticker,
    companyName: company.companyName,
    exchange: company.exchange ?? null,
    secStage: company.secStage,
    reason: exceptionReason(company),
    lastError: company.lastError ?? null,
  })),
  note:
    !candidateTargetLoaded
      ? `Production currently has ${universeSize} active candidates loaded of the prepared ${candidateTarget} target. Only ${loadedCandidateHeadroom} additional loaded candidates are executable now; ${candidateImportShortfall} more candidates still need to be imported. Prepared headroom is ${preparedCandidateHeadroom}, so do not treat the configured reserve as live capacity yet.`
      : examinedCount < candidateTarget
        ? observedRateProjectsTargetSuccess
          ? `At the observed ${observedSecCompletionRatePercent}% SEC-evidence-ready rate, production needs about ${estimatedAdditionalCandidatesNeededAtObservedRate} more candidates (${estimatedTotalCandidatesNeededAtObservedRate} total examined) to reach ${usableTarget}. Filling all ${preparedCandidateHeadroom} remaining slots projects roughly ${projectedSecCompleteAtCandidateTarget} evidence-ready stocks, a ${projectedUsableSurplusAtCandidateTarget}-stock cushion.`
          : expansionRecommended
            ? `The current ${candidateTarget}-candidate pool does not project reaching ${usableTarget} SEC-evidence-ready stocks. Expand to at least ${recommendedCandidateTarget} candidates instead of retrying unchanged lower-priority unresolved names.`
            : `Production has ${preparedCandidateHeadroom} unused candidate slots for a ${usableShortfall}-stock SEC-evidence-ready shortfall.`
        : targetSatisfied
          ? `Production has at least ${usableTarget} SEC-evidence-ready companies, every protected stock is evidence-ready, and no SEC records remain failed. The reserve milestone is complete.`
          : secCountTargetSatisfied && failedCount > 0
            ? `Production has at least ${usableTarget} SEC-evidence-ready companies, but ${failedCount} SEC record(s) remain failed. Keep cleanup running until those rows become complete or explicit nonblocking unresolved exceptions; do not call the reserve milestone complete yet.`
            : secCountTargetSatisfied && mustFix.length > 0
              ? `Production has at least ${usableTarget} SEC-evidence-ready companies, but ${mustFix.length} protected stock(s) remain incomplete. Keep those names on the mandatory repair path; lower-priority unresolved names remain replaceable exceptions.`
              : expansionRecommended
                ? `The ${candidateTarget}-candidate pool is exhausted and still needs ${usableShortfall} SEC-evidence-ready companies. Expand to ${recommendedCandidateTarget} candidates rather than retrying unchanged lower-priority unresolved names.`
                : expansionCeilingReached
                  ? `The ${maximumCandidateTarget}-candidate safety ceiling is exhausted and production still needs ${usableShortfall} SEC-evidence-ready companies. Remaining failures stay exceptions; only separate priority repair work should continue.`
                  : `The current candidate pool is exhausted and still needs ${usableShortfall} SEC-evidence-ready companies.`,
};

console.log("Next Year's Monsters reserve/backfill report:");
console.log(JSON.stringify(report, null, 2));
