// TS: 2026-08-18 17:02 ET

const apiBaseUrl = (process.env.NYM_API_BASE_URL || "https://next-years-monsters-api.onrender.com")
  .trim()
  .replace(/\/$/, "");
const candidateTarget = Number(process.env.NYM_CANDIDATE_TARGET || "5000");

if (!Number.isInteger(candidateTarget) || candidateTarget < 1 || candidateTarget > 5000) {
  throw new Error("NYM_CANDIDATE_TARGET must be an integer from 1 to 5000.");
}

const protectedTickers = new Set([
  "AAPL", "NVDA", "MNST", "AMZN", "TSLA", "NFLX", "AMD", "COST", "VRT", "AXON",
  "DECK", "WING", "META", "APP", "MSFT", "GOOGL", "GOOG", "AVGO", "PLTR", "CRDO",
  "RKLB", "QCOM", "MU", "ARM", "DELL", "INTC", "MRVL", "HOOD", "COIN", "UBER",
]);

function isProtected(company) {
  return company?.isPilot === true || protectedTickers.has(String(company?.ticker || "").toUpperCase());
}

function reasonBucket(company) {
  const message = String(company?.lastError || "").toLowerCase();
  const ticker = String(company?.ticker || "").toUpperCase();
  const exchange = String(company?.exchange || "unknown").toUpperCase();

  if (message.includes("companies_sec_cik_unique") || message.includes("duplicate") && message.includes("cik")) {
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
  if (exchange === "OTC" || exchange.includes("OTC")) {
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
const companies = Array.isArray(status?.companies) ? status.companies : [];
const exceptions = companies.filter((company) => company?.secStage === "unresolved" || company?.secStage === "failed");
const protectedExceptions = exceptions.filter(isProtected);
const replaceableExceptions = exceptions.filter((company) => !isProtected(company));

const byReason = new Map();
const byExchange = new Map();
for (const company of exceptions) {
  increment(byReason, reasonBucket(company));
  increment(byExchange, String(company?.exchange || "unknown").toUpperCase());
}

const report = {
  generatedAt: new Date().toISOString(),
  candidateTarget,
  examinedCount: Number(status?.examinedCount || 0),
  secCompleteCount: Number(status?.secCompleteCount || 0),
  unresolvedCount: Number(status?.unresolvedCount || 0),
  failedCount: Number(status?.failedCount || 0),
  exceptionCountVisible: exceptions.length,
  protectedExceptionCount: protectedExceptions.length,
  protectedExceptions: protectedExceptions.map((company) => ({
    ticker: company.ticker,
    companyName: company.companyName,
    exchange: company.exchange ?? null,
    secStage: company.secStage,
    lastError: company.lastError ?? null,
  })),
  replaceableExceptionCount: replaceableExceptions.length,
  reasonBuckets: Object.fromEntries([...byReason.entries()].sort((a, b) => b[1] - a[1])),
  exchangeBuckets: Object.fromEntries([...byExchange.entries()].sort((a, b) => b[1] - a[1])),
  sampleReplaceable: replaceableExceptions.slice(0, 50).map((company) => ({
    ticker: company.ticker,
    companyName: company.companyName,
    exchange: company.exchange ?? null,
    secStage: company.secStage,
    reason: reasonBucket(company),
    lastError: company.lastError ?? null,
  })),
};

console.log("Next Year's Monsters SEC exception classification:");
console.log(JSON.stringify(report, null, 2));
