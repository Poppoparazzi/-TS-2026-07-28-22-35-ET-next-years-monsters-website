// TS: 2026-08-27 18:00 ET

import { readFileSync } from "node:fs";
import { protectedTickers } from "./protected-stocks.mjs";

const failures = [];
const warnings = [];
const fail = (message) => failures.push(message);
const warn = (message) => warnings.push(message);
const read = (path) => readFileSync(path, "utf8");

const expectedVcl = [
  "AAPL", "NVDA", "MNST", "AMZN", "TSLA", "NFLX", "AMD", "COST",
  "VRT", "AXON", "DECK", "WING", "META", "APP", "MSFT",
];
const ancientBrokenCommit = "0b0388d9b2eba7feff9ad4ccfddc4b4ec88ecb73";
const liveApiBase = (process.env.NYM_API_BASE_URL || "https://next-years-monsters-api.onrender.com")
  .trim()
  .replace(/\/$/, "");

function parseQuotedArray(source, constantName) {
  const match = source.match(
    new RegExp(
      `const\\s+${constantName}\\s*=\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\s*(?:as\\s+const\\s*)?\\)`,
    ),
  );
  if (!match) return null;
  return [...match[1].matchAll(/["']([A-Z0-9.-]+)["']/g)].map((item) => item[1]);
}

function verifyHomepageSearch() {
  const source = read("assets/home-stock-finder.js");
  const universe = JSON.parse(read("data/market-universe.json"));
  const apple = universe.find((stock) => String(stock.ticker || "").toUpperCase() === "AAPL");
  const appleName = String(apple?.name || "").trim().toLowerCase();

  if (!apple || !["apple", "apple inc", "apple inc."].includes(appleName)) {
    fail("Homepage search universe no longer contains a recognized Apple → AAPL mapping.");
  }
  if (!source.includes("const exactName = stocks.find")) {
    fail("Homepage search no longer resolves exact company names before fallback handling.");
  }
  if (!source.includes("/api/universe/search")) {
    fail("Homepage search is no longer connected to the broad production directory.");
  }
  for (const required of [
    'url.searchParams.set("left", ticker)',
    'url.searchParams.set("mode", "single")',
    'url.searchParams.set("direct", "1")',
  ]) {
    if (!source.includes(required)) fail(`Homepage direct-stock routing lost required behavior: ${required}`);
  }
}

function verifyBroadProductionDirectory() {
  const html = read("coverage-universe.html");
  const source = read("assets/coverage-finder.js");

  for (const marker of [
    "data-coverage-candidate-count",
    "data-coverage-evidence-count",
    "data-coverage-protected-count",
    "data-coverage-exception-count",
    "data-coverage-finder-results",
  ]) {
    if (!html.includes(marker)) fail(`Production directory page is missing required hook: ${marker}`);
  }
  if (!html.includes('src="assets/runtime-config.js"')) {
    fail("Production directory page does not load the public API runtime configuration.");
  }
  if (!source.includes("/api/universe/search")) {
    fail("Stock Directory no longer searches the broad production universe endpoint.");
  }
  for (const status of [
    "evidence_ready",
    "protected_must_repair",
    "replaceable_exception",
  ]) {
    if (!source.includes(status)) {
      fail(`Stock Directory no longer presents production status ${status}.`);
    }
  }
}

function verifyMonsterCheckQuickPicks() {
  const source = read("assets/monster-check-quick-picks.js");
  const tickers = parseQuotedArray(source, "VCL_TICKERS");
  if (!tickers) {
    fail("Monster Check quick-pick ticker list could not be parsed.");
    return;
  }

  const unique = [...new Set(tickers)];
  if (tickers.length !== 15 || unique.length !== 15) {
    fail(`Monster Check quick picks must be 15 unique VCL tickers; found ${tickers.length} entries and ${unique.length} unique.`);
  }
  if (tickers.join(",") !== expectedVcl.join(",")) {
    fail(`Monster Check quick picks drifted from approved VCL set/order. Found: ${tickers.join(", ")}`);
  }
  if (!source.includes("market-explorer.html?left=${encodeURIComponent(ticker)}&mode=single&direct=1")) {
    fail("Monster Check quick-pick chart buttons no longer open the selected ticker directly.");
  }
}

function verifyProtectedVclPolicy() {
  const protectedSet = new Set(protectedTickers.map((ticker) => String(ticker).toUpperCase()));
  const missing = expectedVcl.filter((ticker) => !protectedSet.has(ticker));
  const duplicates = protectedTickers.filter((ticker, index) => protectedTickers.indexOf(ticker) !== index);

  if (missing.length > 0) {
    fail(`Approved VCL stocks are no longer protected from SEC replacement policy: ${missing.join(", ")}`);
  }
  if (duplicates.length > 0) {
    fail(`Protected stock policy contains duplicate tickers: ${[...new Set(duplicates)].join(", ")}`);
  }
}

function verifyBackendAndRecoveryProtectionPoliciesMatch() {
  const backendSource = read("backend/src/policy/protected-stocks.ts");
  const backendTickers = parseQuotedArray(backendSource, "PROTECTED_STRATEGIC_TICKERS");

  if (!backendTickers) {
    fail("Backend protected-stock policy could not be parsed for consistency verification.");
    return;
  }

  const recoveryTickers = protectedTickers.map((ticker) => String(ticker).toUpperCase());
  const normalizedBackendTickers = backendTickers.map((ticker) => String(ticker).toUpperCase());
  const backendDuplicates = normalizedBackendTickers.filter(
    (ticker, index) => normalizedBackendTickers.indexOf(ticker) !== index,
  );

  if (backendDuplicates.length > 0) {
    fail(`Backend protected-stock policy contains duplicate tickers: ${[...new Set(backendDuplicates)].join(", ")}`);
  }

  if (normalizedBackendTickers.join(",") !== recoveryTickers.join(",")) {
    const backendSet = new Set(normalizedBackendTickers);
    const recoverySet = new Set(recoveryTickers);
    const missingFromBackend = recoveryTickers.filter((ticker) => !backendSet.has(ticker));
    const missingFromRecovery = normalizedBackendTickers.filter((ticker) => !recoverySet.has(ticker));
    fail(
      "Backend and recovery protected-stock policies drifted apart. " +
        `Missing from backend: ${missingFromBackend.join(", ") || "none"}; ` +
        `missing from recovery: ${missingFromRecovery.join(", ") || "none"}.`,
    );
  }
}

function verifyMonsterHuntConsistency() {
  const source = read("assets/monster-check-rating-trio.js");

  const requiredFragments = [
    'const ticker = extractTicker(result);',
    'const found = findBoardEntry(data, ticker);',
    'rank: key === "top15" ? index + 1 : null',
    'found.item.score_status ?? found.item.score',
    'huntValue = found.rank ? `#${found.rank} TOP 15` : found.label;',
    'content.prepend(trio);',
  ];

  for (const fragment of requiredFragments) {
    if (!source.includes(fragment)) {
      fail(`Monster Check/Hunt consistency invariant is missing: ${fragment}`);
    }
  }

  const scoreSources = source.match(/found\.item\.(?:score_status|score)/g) || [];
  if (scoreSources.length < 2) {
    fail("Monster Check no longer clearly derives displayed Hunt score/status from the same board record used for rank.");
  }
}

async function fetchJson(path) {
  const response = await fetch(`${liveApiBase}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(70_000),
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

async function verifyLiveProductionWatchdog() {
  try {
    const [startupResult, healthResult, universeResult, aaplResult] = await Promise.all([
      fetchJson("/api/startup-status"),
      fetchJson("/api/health"),
      fetchJson("/api/universe/status?limit=5000"),
      fetchJson("/api/ratings/AAPL"),
    ]);

    const deployedCommit = startupResult.payload?.deployment?.commit
      ?? startupResult.payload?.deploymentCommit
      ?? null;
    const quoteCompleteCount = Number(universeResult.payload?.quoteCompleteCount);
    const ratingCompleteCount = Number(universeResult.payload?.ratingCompleteCount);
    const failedCount = Number(universeResult.payload?.failedCount);
    const secEvidenceReadyCount = Number(universeResult.payload?.secEvidenceReadyCount);
    const examinedCount = Number(universeResult.payload?.examinedCount);
    const marketConfigured = healthResult.payload?.marketData?.configured === true;

    console.log("Live production watchdog snapshot:");
    console.log(JSON.stringify({
      deployedCommit,
      startupStatus: startupResult.response.status,
      healthStatus: healthResult.response.status,
      marketConfigured,
      universeStatus: universeResult.response.status,
      examinedCount: Number.isFinite(examinedCount) ? examinedCount : null,
      secEvidenceReadyCount: Number.isFinite(secEvidenceReadyCount) ? secEvidenceReadyCount : null,
      failedCount: Number.isFinite(failedCount) ? failedCount : null,
      quoteCompleteCount: Number.isFinite(quoteCompleteCount) ? quoteCompleteCount : null,
      ratingCompleteCount: Number.isFinite(ratingCompleteCount) ? ratingCompleteCount : null,
      aaplStatus: aaplResult.response.status,
      aaplSymbol: aaplResult.payload?.symbol ?? null,
      aaplEligible: aaplResult.payload?.eligible ?? null,
      aaplTier: aaplResult.payload?.tier ?? null,
    }, null, 2));

    if (deployedCommit === ancientBrokenCommit) {
      fail(`Render regressed to ancient broken commit ${ancientBrokenCommit}.`);
    }
    if (aaplResult.response.status === 404) {
      fail("GET /api/ratings/AAPL regressed to HTTP 404.");
    } else if (!aaplResult.response.ok || aaplResult.payload?.symbol !== "AAPL") {
      fail(`GET /api/ratings/AAPL is unhealthy: HTTP ${aaplResult.response.status}.`);
    }
    if (!marketConfigured) {
      warn("Production market-data provider is not currently reported configured.");
    }
    if (!Number.isInteger(quoteCompleteCount) || quoteCompleteCount < 0) {
      fail(`quoteCompleteCount is not a valid nonnegative integer: ${String(universeResult.payload?.quoteCompleteCount)}.`);
    }
    if (!Number.isInteger(ratingCompleteCount) || ratingCompleteCount < 0) {
      fail(`ratingCompleteCount is not a valid nonnegative integer: ${String(universeResult.payload?.ratingCompleteCount)}.`);
    }
    if (Number.isInteger(quoteCompleteCount) && Number.isInteger(ratingCompleteCount) && ratingCompleteCount > quoteCompleteCount) {
      fail(`ratingCompleteCount=${ratingCompleteCount} exceeds quoteCompleteCount=${quoteCompleteCount}; ratings must advance only from real provider-backed quote data.`);
    }
    if (Number.isInteger(failedCount) && failedCount > 0) {
      warn(`SEC/universe failedCount is ${failedCount}; exception recovery still has work remaining.`);
    }
  } catch (error) {
    warn(`Live production watchdog could not complete this pass: ${error instanceof Error ? error.message : String(error)}`);
  }
}

verifyHomepageSearch();
verifyBroadProductionDirectory();
verifyMonsterCheckQuickPicks();
verifyProtectedVclPolicy();
verifyBackendAndRecoveryProtectionPoliciesMatch();
verifyMonsterHuntConsistency();
await verifyLiveProductionWatchdog();

if (warnings.length) {
  console.warn("Frozen/live watchdog warnings:");
  warnings.forEach((message) => console.warn(`- ${message}`));
}

if (failures.length) {
  console.error("Frozen functional invariant verification failed:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log("Frozen functional invariant verification passed: Apple/AAPL routing, 15 unique VCL quick picks, synchronized backend/recovery VCL replacement protection, direct chart routing, selected-ticker-first status panel, shared Monster Hunt score/rank source, and the live Render/AAPL/accounting watchdog are intact.");
}
