// TS: 2026-08-21 17:08 UTC

import { execFileSync } from "node:child_process";

const apiBaseUrl = (process.env.NYM_API_BASE_URL || "https://next-years-monsters-api.onrender.com")
  .trim()
  .replace(/\/$/, "");
const expectedEngineVersion = (
  process.env.NYM_EXPECTED_RATING_ENGINE || "nym-current-stock-rating-v1.0.0"
).trim();
const symbols = (process.env.NYM_RATING_SMOKE_SYMBOLS || "AAPL,CRDO,RKLB,MSFT")
  .split(",")
  .map((symbol) => symbol.trim().toUpperCase())
  .filter(Boolean);
const attemptCount = Number(process.env.NYM_RATING_SMOKE_ATTEMPTS || "12");
const delayMs = Number(process.env.NYM_RATING_SMOKE_DELAY_MS || "30000");
const healthTimeoutMs = Number(process.env.NYM_RATING_HEALTH_TIMEOUT_MS || "75000");
const routeTimeoutMs = Number(process.env.NYM_RATING_ROUTE_TIMEOUT_MS || "30000");
const allowKnownStaleBlocked = process.env.NYM_ALLOW_KNOWN_STALE_BLOCKED === "1";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function timeoutMessage(label, timeoutMs) {
  return `${label} did not respond within ${Math.round(timeoutMs / 1000)}s; Render may be sleeping, starting, or unresponsive.`;
}

async function requestJson(url, timeoutMs = 70_000, label = url) {
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error(timeoutMessage(label, timeoutMs));
    }
    throw error;
  }

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label} returned non-JSON content with HTTP ${response.status}.`);
  }

  if (!response.ok) {
    throw new Error(
      `${label} returned HTTP ${response.status}: ${payload?.message || payload?.error || "no JSON error"}`,
    );
  }

  return payload;
}

async function optionalJson(url, timeoutMs, label) {
  try {
    return await requestJson(url, timeoutMs, label);
  } catch {
    return null;
  }
}

function hasDeployRelevantChangesSince(deploymentCommit) {
  if (!deploymentCommit) return null;
  try {
    execFileSync(
      "git",
      ["diff", "--quiet", `${deploymentCommit}..HEAD`, "--", "backend", "render.yaml"],
      { stdio: "ignore" },
    );
    return false;
  } catch (error) {
    if (typeof error?.status === "number" && error.status === 1) return true;
    return null;
  }
}

function validateRating(symbol, rating, marketConfigured) {
  const problems = [];

  if (rating?.symbol !== symbol) problems.push(`symbol is ${rating?.symbol || "missing"}`);
  const allowedFailClosedVersion = "nym-current-stock-rating-v0.1-readiness-only";
  if (rating?.engineVersion !== expectedEngineVersion &&
      !(marketConfigured === false && rating?.engineVersion === allowedFailClosedVersion)) {
    problems.push(`engineVersion is ${rating?.engineVersion || "missing"}`);
  }
  if (marketConfigured) {
    if (rating?.eligible !== true) problems.push("eligible must be true with the production scoring dependencies configured");
    if (!Number.isFinite(Number(rating?.score)) || Number(rating.score) < 0 || Number(rating.score) > 100) {
      problems.push(`score is ${String(rating?.score)}`);
    }
    if (!rating?.tier || rating.tier === "NOT YET RATED") problems.push(`tier is ${rating?.tier || "missing"}`);
  } else {
    if (rating?.eligible !== false) problems.push("eligible must remain false while market data is unconfigured");
    if (rating?.score !== null) problems.push("score must remain null while market data is unconfigured");
    if (rating?.tier !== "NOT YET RATED") problems.push(`tier is ${rating?.tier || "missing"}`);
  }
  if (!Array.isArray(rating?.evidenceInputs)) problems.push("evidenceInputs is missing");
  if (!Array.isArray(rating?.components)) problems.push("components is missing");
  if (!Array.isArray(rating?.reasons)) problems.push("reasons is missing");

  const risk = Array.isArray(rating?.components)
    ? rating.components.find((component) => component?.key === "risk_deterioration")
    : null;
  if (!risk) {
    problems.push("risk_deterioration component is missing");
  } else if (marketConfigured) {
    if (!Number.isFinite(Number(risk.score))) problems.push("risk_deterioration score is not numeric");
    if (risk.direction === "unavailable") problems.push("risk_deterioration remains unavailable");
  } else {
    if (risk.score !== null) problems.push("risk_deterioration score must be null");
    if (risk.sourceUrl !== null) problems.push("risk_deterioration sourceUrl must be null until verified");
    if (risk.sourceTimestamp !== null) {
      problems.push("risk_deterioration sourceTimestamp must be null until verified");
    }
  }

  const allowedEligibilityCodes = marketConfigured
    ? new Set(["eligible"])
    : new Set(["risk_and_versioned_calculation_not_connected", "required_evidence_incomplete"]);
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
    score: rating.score,
    tier: rating.tier,
    calculatedAt: rating.calculatedAt || null,
  };
}

async function probeRatingRoute(symbol) {
  try {
    const rating = await requestJson(
      `${apiBaseUrl}/api/ratings/${encodeURIComponent(symbol)}`,
      routeTimeoutMs,
      `${symbol} rating route`,
    );
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
  const health = await requestJson(`${apiBaseUrl}/api/health`, healthTimeoutMs, "API health endpoint");
  if (health?.status !== "ok") throw new Error("API health status is not ok.");

  const startup = await optionalJson(
    `${apiBaseUrl}/api/startup-status`,
    Math.min(healthTimeoutMs, 60_000),
    "API startup-status endpoint",
  );
  const deploymentCommit = String(startup?.deploymentCommit || "").trim();
  const deployRelevantChangesPending = hasDeployRelevantChangesSince(deploymentCommit);
  const firstSymbol = symbols[0] || "AAPL";
  const routeProbe = await probeRatingRoute(firstSymbol);

  if (deployRelevantChangesPending === true) {
    const knownStale404 = !routeProbe.available && /HTTP 404\b/.test(routeProbe.error || "");
    if (allowKnownStaleBlocked && knownStale404) {
      return {
        blocked: true,
        blocker: "stale_render_deployment",
        apiStatus: health.status,
        apiVersion: health.version || null,
        deploymentCommit: deploymentCommit || null,
        deployRelevantChangesPending,
        ratingRouteStatus: 404,
        ratingRouteError: routeProbe.error,
        expectedEngineVersion,
      };
    }

    const routeState = routeProbe.available
      ? `${firstSymbol} rating route responds on the stale deployment`
      : `${firstSymbol} rating route probe failed: ${routeProbe.error}`;
    throw new Error(
      `Render is serving stale commit ${deploymentCommit}; backend/render.yaml changes exist after that SHA; ${routeState}.`,
    );
  }

  if (!routeProbe.available) {
    throw new Error(routeProbe.error || `${firstSymbol} rating route is unavailable.`);
  }

  const marketConfigured = Boolean(health?.marketData?.configured);
  const summaries = [validateRating(firstSymbol, routeProbe.rating, marketConfigured)];
  for (const symbol of symbols.slice(1)) {
    const rating = await requestJson(
      `${apiBaseUrl}/api/ratings/${encodeURIComponent(symbol)}`,
      routeTimeoutMs,
      `${symbol} rating route`,
    );
    summaries.push(validateRating(symbol, rating, marketConfigured));
  }

  return {
    blocked: false,
    apiStatus: health.status,
    apiVersion: health.version || null,
    deploymentCommit: deploymentCommit || null,
    deployRelevantChangesPending,
    expectedEngineVersion,
    healthTimeoutMs,
    routeTimeoutMs,
    symbols: summaries,
  };
}

let lastError = null;

for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
  try {
    const summary = await verifyOnce();
    if (summary.blocked) {
      console.log("Production Current Stock Rating path is blocked by the known stale Render deployment; no new rating-path regression was detected.");
      console.log(JSON.stringify(summary, null, 2));
      process.exit(0);
    }
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
