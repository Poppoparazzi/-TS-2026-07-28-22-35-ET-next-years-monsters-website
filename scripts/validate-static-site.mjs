// TS: 2026-08-04 19:18 ET

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import vm from "node:vm";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    fail(`Missing required file: ${relativePath}`);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function validateJavaScript() {
  const assetsDirectory = join(root, "assets");
  const files = readdirSync(assetsDirectory)
    .filter((name) => extname(name) === ".js")
    .sort();

  files.forEach((name) => {
    const relativePath = join("assets", name);
    const source = read(relativePath);
    if (!source) return;

    try {
      new vm.Script(source, { filename: relativePath });
    } catch (error) {
      fail(`JavaScript syntax error in ${relativePath}: ${error.message}`);
    }
  });
}

function isLocalReference(value) {
  return Boolean(value)
    && !value.startsWith("#")
    && !value.startsWith("http://")
    && !value.startsWith("https://")
    && !value.startsWith("mailto:")
    && !value.startsWith("tel:")
    && !value.startsWith("javascript:")
    && !value.startsWith("data:");
}

function decodeLocalReference(value, sourceFile) {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    fail(`${sourceFile} contains a malformed URL-encoded local reference: ${value}`);
    return value;
  }
}

function validateLocalReferences() {
  const htmlFiles = readdirSync(root)
    .filter((name) => extname(name) === ".html")
    .sort();
  const referencePattern = /(?:href|src)=["']([^"']+)["']/g;

  htmlFiles.forEach((name) => {
    const html = read(name);
    let match;

    while ((match = referencePattern.exec(html)) !== null) {
      const rawReference = match[1];
      if (!isLocalReference(rawReference)) continue;

      const cleanReference = rawReference.split(/[?#]/, 1)[0];
      const decodedReference = decodeLocalReference(cleanReference, name);
      const relativePath = normalize(decodedReference.replace(/^\.\//, ""));
      if (!relativePath || relativePath.startsWith("..")) continue;

      if (!existsSync(join(root, relativePath))) {
        fail(`${name} references missing local file: ${rawReference}`);
      }
    }
  });
}

function validateVclOrder() {
  const html = read("vcl-library.html");
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] || "";
  const tickers = [...tbody.matchAll(/<td><strong>([A-Z]+)<\/strong>/g)]
    .map((match) => match[1]);
  const expected = [
    "NVDA", "AAPL", "MNST", "AMZN", "TSLA", "NFLX", "AMD", "COST",
    "MSFT", "META", "APP", "VRT", "AXON", "DECK", "WING",
  ];

  if (tickers.join(",") !== expected.join(",")) {
    fail(`VCL print-master order changed. Expected ${expected.join(", ")}; found ${tickers.join(", ")}.`);
  }

  ["platinum", "gold", "silver", "bronze", "goblin", "cemetery"].forEach((tier) => {
    if (!html.includes(`data-tier="${tier}"`)) {
      fail(`VCL scale is missing the approved ${tier} rating band.`);
    }
  });

  expected.forEach((ticker) => {
    if (!html.includes(`monster-check.html?ticker=${ticker}`)) {
      fail(`VCL case ${ticker} is missing its Monster Check route.`);
    }
    if (!html.includes(`market-explorer.html?left=${ticker}&amp;mode=single`)) {
      fail(`VCL case ${ticker} is missing its Full Charts route.`);
    }
  });

  if (!html.includes("Platinum case rating")) {
    fail("VCL library does not preserve the approved Netflix printed exception.");
  }
  if (!html.includes("High-quality compounder case")) {
    fail("VCL library does not preserve the approved Costco printed exception.");
  }
  if (html.includes("production VCL pages will")) {
    fail("VCL library still contains the obsolete future-only page promise.");
  }
}

function validateVerificationLedger() {
  const html = read("verification-ledger.html");
  const script = read("assets/verification-ledger.js");

  [
    "data-verification-body",
    "data-run-verification",
    "data-sec-count",
    "data-stored-count",
    "data-quote-count",
    "data-rating-count",
  ].forEach((attribute) => {
    if (!html.includes(attribute)) {
      fail(`Verification ledger is missing required hook: ${attribute}`);
    }
  });

  const tickers = [
    "AAPL", "NVDA", "MNST", "AMZN", "TSLA", "NFLX", "AMD", "COST",
    "VRT", "AXON", "DECK", "WING", "META", "APP", "MSFT",
  ];

  tickers.forEach((ticker) => {
    if (!script.includes(`ticker: "${ticker}"`)) {
      fail(`Verification ledger script is missing pilot ticker ${ticker}.`);
    }
  });

  if (!script.includes("/api/sec/company/")) {
    fail("Verification ledger does not check the official SEC company route.");
  }
  if (!script.includes("/api/stored/")) {
    fail("Verification ledger does not check the persistent snapshot route.");
  }
}

function validateFactoryStatus() {
  const html = read("factory-status.html");
  const script = read("assets/factory-status.js");

  [
    "data-factory-refresh",
    "data-factory-checked",
    "data-factory-universe",
    "data-factory-queued",
    "data-factory-processing",
    "data-factory-complete",
    "data-factory-unresolved",
    "data-factory-failed",
    "data-factory-stale",
    "data-factory-progress-bar",
    "data-factory-body",
  ].forEach((attribute) => {
    if (!html.includes(attribute)) {
      fail(`2,000-stock factory page is missing required hook: ${attribute}`);
    }
  });

  if (!script.includes("FACTORY_LIMIT = 2000")) {
    fail("2,000-stock factory page does not set the bulk universe request limit to 2,000.");
  }
  if (!script.includes("/api/universe/status?limit=${FACTORY_LIMIT}")) {
    fail("2,000-stock factory page does not read the bulk universe status endpoint.");
  }

  [
    "queuedCount",
    "processingCount",
    "secCompleteCount",
    "unresolvedCount",
    "failedCount",
    "staleCount",
  ].forEach((field) => {
    if (!script.includes(field)) {
      fail(`2,000-stock factory logic does not display required progress field: ${field}`);
    }
  });

  const navigationScript = read("assets/market-ticker-strip.js");
  if (!navigationScript.includes("factory-status.html")) {
    fail("Site-wide navigation does not include the 2,000-stock factory page.");
  }
  if (!navigationScript.includes("2,000-STOCK FACTORY")) {
    fail("Site-wide navigation does not label the factory with the current 2,000-company target.");
  }
}

validateJavaScript();
validateLocalReferences();
validateVclOrder();
validateVerificationLedger();
validateFactoryStatus();

if (failures.length) {
  console.error("Static-site validation failed:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log("Static-site validation passed.");
}
