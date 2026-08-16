// TS: 2026-08-16 16:00 ET

const apiBaseUrl = (process.env.NYM_API_BASE_URL || "https://next-years-monsters-api.onrender.com")
  .trim()
  .replace(/\/$/, "");
const factoryPageUrl = (process.env.NYM_FACTORY_PAGE_URL ||
  "https://poppoparazzi.github.io/-TS-2026-07-28-22-35-ET-next-years-monsters-website/factory-status.html")
  .trim();
const expectedVersion = (process.env.NYM_EXPECTED_VERSION || "0.6.0").trim();
const expectedUniverseMinimum = Number(process.env.NYM_EXPECTED_UNIVERSE_MIN || "2000");
const attemptCount = Number(process.env.NYM_SMOKE_ATTEMPTS || "10");
const delayMs = Number(process.env.NYM_SMOKE_DELAY_MS || "30000");

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

async function requestPage(url) {
  const response = await fetch(url, {
    headers: { Accept: "text/html" },
    signal: AbortSignal.timeout(30_000),
  });
  const html = await response.text();

  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}.`);
  if (!html.includes("STOCK FACTORY") || !html.includes("data-factory-body")) {
    throw new Error("The deployed factory page does not contain the expected dashboard content.");
  }
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

  const commit = startup.deploymentCommit || "unknown commit";
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

function validateUniverse(status, startup) {
  const problems = [];

  if (status?.configured !== true) problems.push("universe endpoint is not configured");
  if (Number(status?.universeSize || 0) < expectedUniverseMinimum) {
    problems.push(`only ${status?.universeSize || 0} companies are stored`);
  }
  if (Number(status?.examinedCount || 0) < expectedUniverseMinimum) {
    problems.push(`only ${status?.examinedCount || 0} companies were returned`);
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

function validateProviderBackedProgress(status, health) {
  const examinedCount = Number(status?.examinedCount || 0);
  const quoteCompleteCount = Number(status?.quoteCompleteCount || 0);
  const ratingCompleteCount = Number(status?.ratingCompleteCount || 0);
  const marketConfigured = Boolean(health?.marketData?.configured);
  const problems = [];

  if (quoteCompleteCount < 0 || quoteCompleteCount > examinedCount) {
    problems.push(`quoteCompleteCount=${quoteCompleteCount} is outside 0..${examinedCount}`);
  }
  if (ratingCompleteCount < 0 || ratingCompleteCount > examinedCount) {
    problems.push(`ratingCompleteCount=${ratingCompleteCount} is outside 0..${examinedCount}`);
  }
  if (!marketConfigured && (quoteCompleteCount > 0 || ratingCompleteCount > 0)) {
    problems.push(
      `provider-backed completion advanced while market data is unconfigured: ` +
      `quoteCompleteCount=${quoteCompleteCount}, ratingCompleteCount=${ratingCompleteCount}`,
    );
  }

  if (problems.length) throw new Error(problems.join("; "));
}

async function verifyOnce() {
  const health = await requestJson(`${apiBaseUrl}/api/health`);
  validateHealth(health);

  const [universe, startup] = await Promise.all([
    requestJson(`${apiBaseUrl}/api/universe/status?limit=${expectedUniverseMinimum}`),
    optionalJson(`${apiBaseUrl}/api/startup-status`),
  ]);
  validateUniverse(universe, startup);
  validateProviderBackedProgress(universe, health);

  await requestPage(factoryPageUrl);

  return {
    apiVersion: health.version,
    deploymentCommit: startup?.deploymentCommit ?? null,
    marketProvider: health.marketData?.provider,
    marketConfigured: Boolean(health.marketData?.configured),
    secProvider: health.sec?.provider,
    databaseProvider: health.database?.provider,
    universeSize: universe.universeSize,
    examinedCount: universe.examinedCount,
    queuedCount: universe.queuedCount,
    processingCount: universe.processingCount,
    secCompleteCount: universe.secCompleteCount,
    partialCount: universe.partialCount,
    failedCount: universe.failedCount,
    staleCount: universe.staleCount,
    unresolvedCount: universe.unresolvedCount,
    filingCompleteCount: universe.filingCompleteCount,
    factsCompleteCount: universe.factsCompleteCount,
    quoteCompleteCount: universe.quoteCompleteCount,
    ratingCompleteCount: universe.ratingCompleteCount,
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
