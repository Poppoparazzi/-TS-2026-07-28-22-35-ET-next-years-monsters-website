// TS: 2026-08-13 01:05 ET

const apiBaseUrl = (process.env.NYM_API_BASE_URL || "https://next-years-monsters-api.onrender.com")
  .trim()
  .replace(/\/$/, "");
const expectedCommit = (process.env.NYM_EXPECTED_COMMIT || process.env.GITHUB_SHA || "").trim();
const expectedEngineVersion = (
  process.env.NYM_EXPECTED_RATING_ENGINE || "nym-current-stock-rating-v0.1-readiness-only"
).trim();
const symbols = (process.env.NYM_RATING_SMOKE_SYMBOLS || "AAPL,CRDO,RKLB,MSFT")
  .split(",")
  .map((symbol) => symbol.trim().toUpperCase())
  .filter(Boolean);
const attemptCount = Number(process.env.NYM_RATING_SMOKE_ATTEMPTS || "12");
const delayMs = Number(process.env.NYM_RATING_SMOKE_DELAY_MS || "30000");

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestJson(url, timeoutMs = 70_000) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${url} returned non-JSON content with HTTP ${response.status}.`);
  }

  if (!response.ok) {
    throw new Error(
      `${url} returned HTTP ${response.status}: ${payload?.message || payload?.error || "no JSON error"}`,
    );
  }

  return payload;
}

async function optionalJson(url) {
  try {
    return await requestJson(url, 30_000);
  } catch {
    return null;
  }
}

function validateRating(symbol, rating) {
  const problems = [];

  if (rating?.symbol !== symbol) problems.push(`symbol is ${rating?.symbol || "missing"}`);
  if (rating?.engineVersion !== expectedEngineVersion) {
    problems.push(`engineVersion is ${rating?.engineVersion || "missing"}`);
  }
  if (rating?.eligible !== false) problems.push("eligible must remain false until the scored model is connected");
  if (rating?.score !== null) problems.push("score must remain null until the scored model is connected");
  if (rating?.tier !== "NOT YET RATED") problems.push(`tier is ${rating?.tier || "missing"}`);
  if (!Array.isArray(rating?.evidenceInputs)) problems.push("evidenceInputs is missing");
  if (!Array.isArray(rating?.components)) problems.push("components is missing");
  if (!Array.isArray(rating?.reasons) || rating.reasons.length === 0) problems.push("reasons is missing");

  const risk = Array.isArray(rating?.components)
    ? rating.components.find((component) => component?.key === "risk_deterioration")
    : null;
  if (!risk) {
    problems.push("risk_deterioration component is missing");
  } else {
    if (risk.score !== null) problems.push("risk_deterioration score must be null");
    if (risk.sourceUrl !== null) problems.push("risk_deterioration sourceUrl must be null until verified");
    if (risk.sourceTimestamp !== null) {
      problems.push("risk_deterioration sourceTimestamp must be null until verified");
    }
  }

  const allowedEligibilityCodes = new Set([
    "risk_and_versioned_calculation_not_connected",
    "required_evidence_incomplete",
  ]);
  if (!allowedEligibilityCodes.has(rating?.eligibilityCode)) {
    problems.push(`unexpected eligibilityCode ${rating?.eligibilityCode || "missing"}`);
  }

  if (problems.length > 0) {
    throw new Error(`${symbol}: ${problems.join("; ")}`);
  }

  return {
    symbol,
    eligibilityCode: rating.eligibilityCode,
    evidenceInputCount: rating.evidenceInputs.length,
    reasonCount: rating.reasons.length,
    calculatedAt: rating.calculatedAt || null,
  };
}

async function probeRatingRoute(symbol) {
  try {
    const rating = await requestJson(`${apiBaseUrl}/api/ratings/${encodeURIComponent(symbol)}`, 30_000);
    return { available: true, rating, error: null };
  } catch (error) {
    return {
      available: false,
      rating: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function verifyOnce() {
  const health = await requestJson(`${apiBaseUrl}/api/health`, 30_000);
  if (health?.status !== "ok") throw new Error("API health status is not ok.");

  const startup = await optionalJson(`${apiBaseUrl}/api/startup-status`);
  const deploymentCommit = String(startup?.deploymentCommit || "").trim();
  const firstSymbol = symbols[0] || "AAPL";
  const routeProbe = await probeRatingRoute(firstSymbol);

  if (expectedCommit && deploymentCommit && deploymentCommit !== expectedCommit) {
    const routeState = routeProbe.available
      ? `${firstSymbol} rating route responds on the stale deployment`
      : `${firstSymbol} rating route probe failed: ${routeProbe.error}`;
    throw new Error(
      `Render is serving stale commit ${deploymentCommit}, expected ${expectedCommit}; ${routeState}.`,
    );
  }

  if (!routeProbe.available) {
    throw new Error(routeProbe.error || `${firstSymbol} rating route is unavailable.`);
  }

  const summaries = [validateRating(firstSymbol, routeProbe.rating)];
  for (const symbol of symbols.slice(1)) {
    const rating = await requestJson(`${apiBaseUrl}/api/ratings/${encodeURIComponent(symbol)}`);
    summaries.push(validateRating(symbol, rating));
  }

  return {
    apiStatus: health.status,
    apiVersion: health.version || null,
    deploymentCommit: deploymentCommit || null,
    expectedCommit: expectedCommit || null,
    expectedEngineVersion,
    symbols: summaries,
  };
}

let lastError = null;

for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
  try {
    const summary = await verifyOnce();
    console.log("Production Current Stock Rating path passed.");
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`Rating-path attempt ${attempt}/${attemptCount} failed: ${error.message}`);
    if (attempt < attemptCount) await sleep(delayMs);
  }
}

console.error(`Production Current Stock Rating path failed: ${lastError?.message || "Unknown failure."}`);
process.exit(1);
