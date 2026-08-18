// TS: 2026-08-18 13:00 ET

const apiBaseUrl = (process.env.NYM_API_BASE_URL || "https://next-years-monsters-api.onrender.com")
  .trim()
  .replace(/\/$/, "");
const candidateTarget = Number(process.env.NYM_CANDIDATE_TARGET || "5000");
const usableTarget = Number(process.env.NYM_USABLE_TARGET || "2000");
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
const usableShortfall = Math.max(usableTarget - secCompleteCount, 0);
const candidateHeadroom = Math.max(candidateTarget - examinedCount, 0);
const candidateImportShortfall = Math.max(candidateTarget - universeSize, 0);
const candidateTargetLoaded = candidateImportShortfall === 0;
const observedSecCompletionRate = examinedCount > 0 ? secCompleteCount / examinedCount : 0;
const observedSecCompletionRatePercent = roundedPercent(secCompleteCount, examinedCount);
const minimumRemainingSuccessRatePercent =
  usableShortfall === 0 ? 0 : roundedPercent(usableShortfall, candidateHeadroom);
const reserveCapacityAdequate = usableShortfall === 0 || candidateHeadroom >= usableShortfall;
const reserveCapacityMargin = candidateHeadroom - usableShortfall;
const projectedSecCompleteAtCandidateTarget = Math.min(
  candidateTarget,
  secCompleteCount + Math.floor(candidateHeadroom * observedSecCompletionRate),
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
const secCountTargetSatisfied = secCompleteCount >= usableTarget;
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

const companies = Array.isArray(status.companies) ? status.companies : [];
const unresolved = companies.filter((company) => company?.secStage === "unresolved");
const failed = companies.filter((company) => company?.secStage === "failed");

// Match the startup worker's completion rule exactly: every protected stock must be
// SEC-complete, regardless of whether its current stage is queued, partial, failed,
// stale, unresolved, or processing. Otherwise the report could declare victory while
// the worker correctly keeps repairing an important name.
const mustFix = companies
  .filter((company) => isProtectedCompany(company) && company?.secStage !== "complete")
  .map((company) => ({
    ticker: company.ticker,
    companyName: company.companyName,
    secStage: company.secStage,
    isPilot: company.isPilot === true,
    lastError: company.lastError ?? null,
  }));
const replaceableVisible = [...unresolved, ...failed]
  .filter((company) => !isProtectedCompany(company))
  .map((company) => company.ticker);
const targetSatisfied = secCountTargetSatisfied && mustFix.length === 0;

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
  unresolvedCount,
  failedCount,
  usableShortfall,
  candidateHeadroom,
  observedSecCompletionRatePercent,
  minimumRemainingSuccessRatePercent,
  estimatedAdditionalCandidatesNeededAtObservedRate,
  estimatedTotalCandidatesNeededAtObservedRate,
  projectedSecCompleteAtCandidateTarget,
  projectedUsableSurplusAtCandidateTarget,
  observedRateProjectsTargetSuccess,
  reserveCapacityAdequate,
  reserveCapacityMargin,
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
  note:
    !candidateTargetLoaded
      ? `Production currently has ${universeSize} active candidates loaded of the prepared ${candidateTarget} target. The reserve expansion is not live yet; production must import ${candidateImportShortfall} more candidates before projections against the full pool can be treated as executable capacity.`
      : examinedCount < candidateTarget
        ? observedRateProjectsTargetSuccess
          ? `At the observed ${observedSecCompletionRatePercent}% SEC-completion rate, production needs about ${estimatedAdditionalCandidatesNeededAtObservedRate} more candidates (${estimatedTotalCandidatesNeededAtObservedRate} total examined) to reach ${usableTarget}. Filling all ${candidateHeadroom} remaining slots projects roughly ${projectedSecCompleteAtCandidateTarget} SEC-complete stocks, a ${projectedUsableSurplusAtCandidateTarget}-stock cushion.`
          : expansionRecommended
            ? `The current ${candidateTarget}-candidate pool does not project reaching ${usableTarget} usable stocks. Expand to at least ${recommendedCandidateTarget} candidates instead of retrying unchanged lower-priority unresolved names.`
            : `Production has ${candidateHeadroom} unused candidate slots for a ${usableShortfall}-stock SEC-complete shortfall.`
        : targetSatisfied
          ? `Production has at least ${usableTarget} SEC-complete companies and every protected stock is complete; unresolved lower-priority names no longer block the active target.`
          : secCountTargetSatisfied && mustFix.length > 0
            ? `Production has reached the ${usableTarget}-stock numeric target, but ${mustFix.length} protected stock(s) are still not SEC-complete and must be repaired before the reserve target is considered complete.`
            : expansionRecommended
              ? `The ${candidateTarget}-candidate pool is exhausted and still needs ${usableShortfall} SEC-complete companies. Expand to ${recommendedCandidateTarget} candidates rather than retrying unchanged lower-priority unresolved names.`
              : expansionCeilingReached
                ? `The ${maximumCandidateTarget}-candidate safety ceiling is exhausted and production still needs ${usableShortfall} SEC-complete companies. At this point only the strategically important unresolved names should be repaired; lower-priority names should remain exceptions.`
                : `The current candidate pool is exhausted and still needs ${usableShortfall} SEC-complete companies.`,
};

console.log("Next Year's Monsters reserve/backfill report:");
console.log(JSON.stringify(report, null, 2));
