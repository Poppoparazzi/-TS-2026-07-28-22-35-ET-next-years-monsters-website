// TS: 2026-08-21 05:02 ET

import { readFileSync } from "node:fs";
import { protectedTickers } from "./protected-stocks.mjs";

const failures = [];
const fail = (message) => failures.push(message);
const read = (path) => readFileSync(path, "utf8");

const expectedVcl = [
  "AAPL", "NVDA", "MNST", "AMZN", "TSLA", "NFLX", "AMD", "COST",
  "VRT", "AXON", "DECK", "WING", "META", "APP", "MSFT",
];

function parseQuotedArray(source, constantName) {
  const match = source.match(new RegExp(`const\\s+${constantName}\\s*=\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)`));
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
  for (const required of [
    'url.searchParams.set("left", ticker)',
    'url.searchParams.set("mode", "single")',
    'url.searchParams.set("direct", "1")',
  ]) {
    if (!source.includes(required)) fail(`Homepage direct-stock routing lost required behavior: ${required}`);
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

verifyHomepageSearch();
verifyMonsterCheckQuickPicks();
verifyProtectedVclPolicy();
verifyMonsterHuntConsistency();

if (failures.length) {
  console.error("Frozen functional invariant verification failed:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log("Frozen functional invariant verification passed: Apple/AAPL routing, 15 unique VCL quick picks, VCL replacement protection, direct chart routing, selected-ticker-first status panel, and shared Monster Hunt score/rank source are intact.");
}
