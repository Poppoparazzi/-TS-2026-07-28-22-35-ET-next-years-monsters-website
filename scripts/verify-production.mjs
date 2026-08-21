// TS: 2026-08-21 17:39 UTC

const apiBaseUrl = (process.env.NYM_API_BASE_URL || "https://next-years-monsters-api.onrender.com")
  .trim()
  .replace(/\/$/, "");
const factoryPageUrl = (process.env.NYM_FACTORY_PAGE_URL ||
  "https://poppoparazzi.github.io/-TS-2026-07-28-22-35-ET-next-years-monsters-website/factory-status.html")
  .trim();
const siteBaseUrl = (process.env.NYM_SITE_BASE_URL || "https://nextyearsmonsters.com")
  .trim()
  .replace(/\/$/, "");
const expectedVersion = (process.env.NYM_EXPECTED_VERSION || "0.6.0").trim();
const expectedUniverseMinimum = Number(process.env.NYM_EXPECTED_UNIVERSE_MIN || "5000");
const statusLimit = Number(process.env.NYM_UNIVERSE_STATUS_LIMIT || "5000");
const attemptCount = Number(process.env.NYM_SMOKE_ATTEMPTS || "10");
const delayMs = Number(process.env.NYM_SMOKE_DELAY_MS || "30000");
const expectedBackfillPolicy = Object.freeze({
  candidateTarget: Number(process.env.NYM_EXPECTED_CANDIDATE_TARGET || "5000"),
  secBatchSize: Number(process.env.NYM_EXPECTED_SEC_BATCH_SIZE || "5000"),
  usableTarget: Number(process.env.NYM_EXPECTED_USABLE_TARGET || "2200"),
  concurrency: Number(process.env.NYM_EXPECTED_SEC_CONCURRENCY || "8"),
  maxAgeHours: Number(process.env.NYM_EXPECTED_SEC_MAX_AGE_HOURS || "720"),
});

if (!Number.isInteger(statusLimit) || statusLimit < expectedUniverseMinimum || statusLimit > 5_000) {
  throw new Error(
    `NYM_UNIVERSE_STATUS_LIMIT must be an integer from ${expectedUniverseMinimum} to 5000.`,
  );
}

for (const [field, value] of Object.entries(expectedBackfillPolicy)) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`Expected backfill policy ${field} must be a nonnegative finite integer.`);
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

async function optionalJson(url) {
  try {
    return await requestJson(url);
  } catch {
    return null;
  }
}

async function requestPage(url, markers) {
  const response = await fetch(url, {
    headers: { Accept: "text/html" },
    signal: AbortSignal.timeout(30_000),
  });
  const html = await response.text();

  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}.`);
  for (const marker of markers) {
    if (!html.includes(marker)) {
      throw new Error(`${url} does not contain expected customer-journey marker ${marker}.`);
    }
  }
}

function deployedCommit(startup) {
  return startup?.deployment?.commit ?? startup?.deploymentCommit ?? null;
}

function validateHealth(health) {
  const problems = [];

  if (health?.status !== "ok") problems.push("API status is not ok");
  if (health?.version !== expectedVersion) {
    problems.push(`API version is ${health?.version || "missing"}, expected ${expectedVersion}`);
  }
  if (!health?.database?.configured) problems.push("production database is not configured");
  if (!health?.sec?.configured) problems.push("SEC provider is not configured");
  if (!health?.universe?.configured) problems.push("bulk universe store is not configured");

  if (problems.length) throw new Error(problems.join("; "));
}

function startupDiagnostic(startup) {
  if (!startup) return "startup diagnostics unavailable, likely an older deployment";

  const commit = deployedCommit(startup) || "unknown commit";
  const importJob = startup.jobs?.universeImport;
  const batchJob = startup.jobs?.secUniverseBatch;
  const importDetail = importJob?.error || JSON.stringify(importJob?.summary ?? null);
  const batchDetail = batchJob?.error || JSON.stringify(batchJob?.summary ?? null);

  return [
    `commit ${commit}`,
    `universe import ${importJob?.state || "missing"}: ${importDetail}`,
    `SEC batch ${batchJob?.state || "missing"}: ${batchDetail}`,
  ].join("; ");
}

function validateBackfillPolicy(startup) {
  if (!startup) {
    throw new Error(
      "startup diagnostics are unavailable; production cannot prove the required backfill policy",
    );
  }

  const policy = startup.backfillPolicy;
  if (!policy) {
    throw new Error(
      `startup backfillPolicy is missing; production cannot prove the required 5000-candidate / 2200-usable reserve policy; ${startupDiagnostic(startup)}`,
    );
  }

  const problems = [];
  for (const [field, expected] of Object.entries(expectedBackfillPolicy)) {
    const actual = Number(policy[field]);
    if (!Number.isFinite(actual) || !Number.isInteger(actual)) {
      problems.push(`backfillPolicy.${field}=${String(policy[field])} is not a finite integer`);
      continue;
    }
    if (actual !== expected) {
      problems.push(`backfillPolicy.${field}=${actual}, expected ${expected}`);
    }
  }

  if (problems.length) {
    problems.push(startupDiagnostic(startup));
    throw new Error(problems.join("; "));
  }
}

function validateUniverse(status, startup) {
  const problems = [];
  const countFields = [
    "universeSize",
    "examinedCount",
    "candidatesExaminedCount",
    "queuedCount",
    "processingCount",
    "secCompleteCount",
    "secEvidenceReadyCount",
    "partialCount",
    "failedCount",
    "staleCount",
    "unresolvedCount",
    "filingCompleteCount",
    "factsCompleteCount",
    "quoteCompleteCount",
    "ratingCompleteCount",
    "finalUsableUniverseCount",
    "protectedMissingCount",
    "protectedMustRepairCount",
    "replaceableFailureCount",
    "replacementsAttemptedCount",
    "reserveCandidatesRemainingCount",
  ];

  for (const field of countFields) {
    const value = Number(status?.[field]);
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      problems.push(`${field}=${String(status?.[field])} is not a nonnegative finite integer`);
    }
  }

  if (status?.configured !== true) problems.push("universe endpoint is not configured");
  if (Number(status?.universeSize || 0) < expectedUniverseMinimum) {
    problems.push(`only ${status?.universeSize || 0} companies are stored`);
  }
  if (Number(status?.examinedCount || 0) < expectedUniverseMinimum) {
    problems.push(`only ${status?.examinedCount || 0} companies were returned`);
  }
  if (Number(status?.requestedLimit) !== statusLimit) {
    problems.push(`requestedLimit=${String(status?.requestedLimit)}, expected ${statusLimit}`);
  }

  const examinedCount = Number(status?.examinedCount);
  const candidatesExaminedCount = Number(status?.candidatesExaminedCount);
  const secEvidenceReadyCount = Number(status?.secEvidenceReadyCount);
  const finalUsableUniverseCount = Number(status?.finalUsableUniverseCount);
  const protectedMissingCount = Number(status?.protectedMissingCount);
  const protectedMustRepairCount = Number(status?.protectedMustRepairCount);
  const replaceableFailureCount = Number(status?.replaceableFailureCount);
  const replacementsAttemptedCount = Number(status?.replacementsAttemptedCount);
  const completionFields = [
    "filingCompleteCount",
    "factsCompleteCount",
    "quoteCompleteCount",
    "ratingCompleteCount",
  ];

  if (Number.isFinite(examinedCount) && examinedCount >= 0) {
    for (const field of completionFields) {
      const value = Number(status?.[field]);
      if (Number.isFinite(value) && value > examinedCount) {
        problems.push(`${field}=${value} exceeds examinedCount=${examinedCount}`);
      }
    }
  }

  if (candidatesExaminedCount > examinedCount) {
    problems.push(
      `candidatesExaminedCount=${candidatesExaminedCount} exceeds examinedCount=${examinedCount}`,
    );
  }
  if (secEvidenceReadyCount < expectedBackfillPolicy.usableTarget) {
    problems.push(
      `secEvidenceReadyCount=${secEvidenceReadyCount}, expected at least ${expectedBackfillPolicy.usableTarget}`,
    );
  }
  if (finalUsableUniverseCount !== secEvidenceReadyCount) {
    problems.push(
      `finalUsableUniverseCount=${finalUsableUniverseCount}, secEvidenceReadyCount=${secEvidenceReadyCount}`,
    );
  }
  if (protectedMissingCount !== 0 || protectedMustRepairCount !== 0) {
    problems.push(
      `protected recovery incomplete: missing=${protectedMissingCount}, mustRepair=${protectedMustRepairCount}`,
    );
  }
  if (Array.isArray(status?.protectedMustRepairTickers) &&
      status.protectedMustRepairTickers.length !== protectedMustRepairCount) {
    problems.push("protectedMustRepairTickers roster length does not match its count");
  }
  if (Array.isArray(status?.replaceableFailureTickers) &&
      status.replaceableFailureTickers.length !== replaceableFailureCount) {
    problems.push("replaceableFailureTickers roster length does not match its count");
  }

  const pipelineTotal = [
    status?.queuedCount,
    status?.processingCount,
    status?.secCompleteCount,
    status?.partialCount,
    status?.failedCount,
    status?.staleCount,
    status?.unresolvedCount,
  ].reduce((total, value) => total + Number(value || 0), 0);

  if (pipelineTotal !== Number(status?.examinedCount || 0)) {
    problems.push(
      `pipeline-state counts total ${pipelineTotal}, but examined count is ${status?.examinedCount || 0}`,
    );
  }

  if (problems.length) {
    problems.push(startupDiagnostic(startup));
    throw new Error(problems.join("; "));
  }
}

function validateRating(rating, marketConfigured) {
  const problems = [];
  if (rating?.symbol !== "AAPL") problems.push(`symbol=${String(rating?.symbol)}`);
  if (marketConfigured) {
    if (rating?.engineVersion !== "nym-current-stock-rating-v1.0.0") {
      problems.push(`engineVersion=${String(rating?.engineVersion)}`);
    }
    if (rating?.eligible !== true || !Number.isFinite(Number(rating?.score)) ||
        Number(rating.score) < 0 || Number(rating.score) > 100 ||
        !rating?.tier || rating.tier === "NOT YET RATED") {
      problems.push("configured production did not return a verified numeric AAPL Monster Rating");
    }
  } else if (rating?.eligible !== false || rating?.score !== null || rating?.tier !== "NOT YET RATED") {
    problems.push("unconfigured production did not retain the truthful fail-closed contract");
  }
  if (!Array.isArray(rating?.evidenceInputs) || !Array.isArray(rating?.reasons)) {
    problems.push("rating evidence/reason arrays are missing");
  }
  if (!marketConfigured && rating?.rollout?.message !== "Not Yet Rated — Stay Tuned. Coming Soon.") {
    problems.push("unrated response is missing the approved coming-soon message");
  }
  if (problems.length) throw new Error(problems.join("; "));
}

function validateProductionDirectory(directory, universe) {
  const problems = [];
  const apple = Array.isArray(directory?.results)
    ? directory.results.find((company) => company?.ticker === "AAPL")
    : null;

  if (directory?.query !== "Apple") problems.push(`directory query=${String(directory?.query)}`);
  if (Number(directory?.universe?.candidateCount) !== Number(universe?.universeSize)) {
    problems.push(
      `directory candidateCount=${String(directory?.universe?.candidateCount)}, ` +
      `universeSize=${String(universe?.universeSize)}`,
    );
  }
  if (Number(directory?.universe?.secEvidenceReadyCount) !== Number(universe?.secEvidenceReadyCount)) {
    problems.push(
      `directory evidenceReady=${String(directory?.universe?.secEvidenceReadyCount)}, ` +
      `universe evidenceReady=${String(universe?.secEvidenceReadyCount)}`,
    );
  }
  if (Number(directory?.universe?.protectedMustRepairCount) !== 0) {
    problems.push(
      `directory protectedMustRepairCount=${String(directory?.universe?.protectedMustRepairCount)}`,
    );
  }
  if (!apple) problems.push("directory search for Apple did not return AAPL");
  if (apple && apple.secEvidenceReady !== true) {
    problems.push("directory returned AAPL without its SEC evidence-ready status");
  }
  if (apple && apple.status !== "evidence_ready") {
    problems.push(`directory returned AAPL status=${String(apple.status)}`);
  }

  if (problems.length) throw new Error(problems.join("; "));
}

function validateProviderBackedProgress(status, health) {
  const examinedCount = Number(status?.examinedCount);
  const quoteCompleteCount = Number(status?.quoteCompleteCount);
  const ratingCompleteCount = Number(status?.ratingCompleteCount);
  const marketConfigured = Boolean(health?.marketData?.configured);
  const problems = [];

  const requiredCounts = [
    ["examinedCount", examinedCount],
    ["quoteCompleteCount", quoteCompleteCount],
    ["ratingCompleteCount", ratingCompleteCount],
  ];

  for (const [name, value] of requiredCounts) {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      problems.push(`${name}=${String(value)} is not a finite integer`);
    }
  }

  if (Number.isFinite(examinedCount) && Number.isFinite(quoteCompleteCount) &&
      (quoteCompleteCount < 0 || quoteCompleteCount > examinedCount)) {
    problems.push(`quoteCompleteCount=${quoteCompleteCount} is outside 0..${examinedCount}`);
  }
  if (Number.isFinite(examinedCount) && Number.isFinite(ratingCompleteCount) &&
      (ratingCompleteCount < 0 || ratingCompleteCount > examinedCount)) {
    problems.push(`ratingCompleteCount=${ratingCompleteCount} is outside 0..${examinedCount}`);
  }
  if (!marketConfigured &&
      ((Number.isFinite(quoteCompleteCount) && quoteCompleteCount > 0) ||
       (Number.isFinite(ratingCompleteCount) && ratingCompleteCount > 0))) {
    problems.push(
      `provider-backed completion advanced while market data is unconfigured: ` +
      `quoteCompleteCount=${quoteCompleteCount}, ratingCompleteCount=${ratingCompleteCount}`,
    );
  }

  if (problems.length) throw new Error(problems.join("; "));
}

function validateRatingBatch(startup, health, universe) {
  if (!health?.marketData?.configured) return;

  const job = startup?.jobs?.ratingBatch;
  const accounting = job?.summary;
  const problems = [];
  const countFields = [
    "targetCount",
    "candidateLimit",
    "totalCandidatesExamined",
    "ratedCount",
    "protectedMustRepairCount",
    "replaceableCount",
    "replacementsAttempted",
    "finalUsableUniverse",
  ];

  if (job?.state !== "completed") problems.push(`ratingBatch state=${String(job?.state)}`);
  if (accounting?.status !== "completed") {
    problems.push(`ratingBatch status=${String(accounting?.status)}`);
  }
  for (const field of countFields) {
    const value = Number(accounting?.[field]);
    if (!Number.isInteger(value) || value < 0) {
      problems.push(`ratingBatch.${field}=${String(accounting?.[field])}`);
    }
  }
  if (Number(accounting?.targetCount) !== 500) {
    problems.push(`ratingBatch.targetCount=${String(accounting?.targetCount)}, expected 500`);
  }
  if (Number(accounting?.ratedCount) < 500 || Number(accounting?.finalUsableUniverse) < 500) {
    problems.push(`only ${String(accounting?.ratedCount)} verified ratings were produced`);
  }
  if (Number(universe?.ratingCompleteCount) < 500) {
    problems.push(`production exposes only ${String(universe?.ratingCompleteCount)} completed ratings`);
  }
  if (Array.isArray(accounting?.protectedMustRepair) &&
      accounting.protectedMustRepair.length !== Number(accounting?.protectedMustRepairCount)) {
    problems.push("protected must-repair rating roster does not match its count");
  }
  if (Array.isArray(accounting?.replaceable) &&
      accounting.replaceable.length !== Number(accounting?.replaceableCount)) {
    problems.push("replaceable rating roster does not match its count");
  }
  if (Number(accounting?.replacementsAttempted) !== Number(accounting?.replaceableCount)) {
    problems.push("rating replacements-attempted accounting is inconsistent");
  }

  if (problems.length) throw new Error(problems.join("; "));
}

async function verifyOnce() {
  const health = await requestJson(`${apiBaseUrl}/api/health`);
  validateHealth(health);

  const [universe, startup, rating, directory] = await Promise.all([
    requestJson(`${apiBaseUrl}/api/universe/status?limit=${statusLimit}`),
    optionalJson(`${apiBaseUrl}/api/startup-status`),
    requestJson(`${apiBaseUrl}/api/ratings/AAPL`),
    requestJson(`${apiBaseUrl}/api/universe/search?q=Apple&limit=12&evidenceReady=true`),
  ]);
  validateBackfillPolicy(startup);
  validateUniverse(universe, startup);
  validateProviderBackedProgress(universe, health);
  validateRatingBatch(startup, health, universe);
  validateRating(rating, Boolean(health.marketData?.configured));
  validateProductionDirectory(directory, universe);

  await Promise.all([
    requestPage(factoryPageUrl, ["STOCK FACTORY", "data-factory-body"]),
    requestPage(`${siteBaseUrl}/`, ["data-home-stock-finder", "live 5,000-candidate production directory"]),
    requestPage(
      `${siteBaseUrl}/coverage-universe.html?q=Apple`,
      ["data-coverage-evidence-count", "ALL 5,000", "assets/runtime-config.js"],
    ),
    requestPage(
      `${siteBaseUrl}/market-explorer.html?left=AAPL&mode=single&direct=1`,
      ["MARKET", "data-explorer-ticker-form"],
    ),
    requestPage(
      `${siteBaseUrl}/monster-check.html?ticker=AAPL`,
      ["MONSTER", "data-ticker-input"],
    ),
  ]);

  return {
    apiVersion: health.version,
    deploymentCommit: deployedCommit(startup),
    backfillPolicy: startup?.backfillPolicy ?? null,
    marketProvider: health.marketData?.provider,
    marketConfigured: Boolean(health.marketData?.configured),
    secProvider: health.sec?.provider,
    databaseProvider: health.database?.provider,
    requestedStatusLimit: statusLimit,
    universeSize: universe.universeSize,
    examinedCount: universe.examinedCount,
    candidatesExaminedCount: universe.candidatesExaminedCount,
    queuedCount: universe.queuedCount,
    processingCount: universe.processingCount,
    secCompleteCount: universe.secCompleteCount,
    secEvidenceReadyCount: universe.secEvidenceReadyCount,
    finalUsableUniverseCount: universe.finalUsableUniverseCount,
    partialCount: universe.partialCount,
    failedCount: universe.failedCount,
    staleCount: universe.staleCount,
    unresolvedCount: universe.unresolvedCount,
    protectedMustRepairCount: universe.protectedMustRepairCount,
    replaceableFailureCount: universe.replaceableFailureCount,
    replacementsAttemptedCount: universe.replacementsAttemptedCount,
    reserveCandidatesRemainingCount: universe.reserveCandidatesRemainingCount,
    filingCompleteCount: universe.filingCompleteCount,
    factsCompleteCount: universe.factsCompleteCount,
    quoteCompleteCount: universe.quoteCompleteCount,
    ratingCompleteCount: universe.ratingCompleteCount,
    ratingRoute: {
      symbol: rating.symbol,
      engineVersion: rating.engineVersion,
      eligibilityCode: rating.eligibilityCode,
    },
    productionDirectory: {
      query: directory.query,
      candidateCount: directory.universe.candidateCount,
      secEvidenceReadyCount: directory.universe.secEvidenceReadyCount,
      appleStatus: directory.results.find((company) => company.ticker === "AAPL")?.status ?? null,
    },
    startupJobs: startup?.jobs ?? null,
    generatedAt: universe.generatedAt,
  };
}

let lastError = null;

for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
  try {
    const summary = await verifyOnce();
    console.log("Production smoke test passed.");
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`Production smoke attempt ${attempt}/${attemptCount} failed: ${error.message}`);
    if (attempt < attemptCount) await sleep(delayMs);
  }
}

console.error(`Production smoke test failed: ${lastError?.message || "Unknown failure."}`);
process.exit(1);
