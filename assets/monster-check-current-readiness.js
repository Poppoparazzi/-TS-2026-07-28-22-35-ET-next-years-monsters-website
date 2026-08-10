// TS: 2026-08-10 05:03 ET

(function installCurrentRatingReadiness() {
  "use strict";

  const page = (window.location.pathname || "").split("/").filter(Boolean).pop();
  if (page && page !== "monster-check.html") return;

  const MAX_QUOTE_AGE_MS = 36 * 60 * 60 * 1000;
  const FIELD_SETS = Object.freeze({
    symbol: ["symbol", "ticker"],
    price: ["price", "currentPrice", "lastPrice", "last", "regularMarketPrice", "close"],
    freshness: ["priceChangeTime", "currentTradeTime", "timestamp", "asOf", "as_of", "lastUpdated", "updatedAt", "retrievedAt"],
    financial: ["revenue", "revenueGrowth", "grossMargin", "operatingMargin", "operatingIncome", "netIncome", "eps", "freeCashFlow", "financials", "metrics"],
    risk: ["risk", "risks", "riskFactors", "riskSignals", "warning", "warnings", "bearCase", "downside", "volatility", "drawdown"],
    score: ["monsterRating", "monster_rating", "rating", "score"],
    version: ["calculationVersion", "calculation_version", "modelVersion", "model_version", "ratingVersion", "rating_version", "engineVersion", "engine_version"]
  });

  function safe(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function apiBase() {
    const raw = window.NYM_CONFIG?.apiBaseUrl;
    if (typeof raw !== "string" || !raw.trim()) return null;
    try {
      const parsed = new URL(raw.trim());
      const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
      if (parsed.protocol !== "https:" && !local) return null;
      return parsed.href.replace(/\/$/, "");
    } catch (_error) {
      return null;
    }
  }

  function findExplicitValue(value, keys, depth = 0) {
    if (depth > 5 || value == null) return undefined;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 30)) {
        const found = findExplicitValue(item, keys, depth + 1);
        if (found !== undefined) return found;
      }
      return undefined;
    }
    if (typeof value !== "object") return undefined;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      const candidate = value[key];
      if (candidate !== null && candidate !== "" && candidate !== undefined) return candidate;
    }
    for (const child of Object.values(value)) {
      const found = findExplicitValue(child, keys, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  function isFiniteNumber(value) {
    return Number.isFinite(Number(value));
  }

  function hasSubstantiveValue(value) {
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "boolean") return true;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return false;
  }

  function normalizedSymbol(data) {
    const raw = findExplicitValue(data, FIELD_SETS.symbol);
    return typeof raw === "string" ? raw.trim().toUpperCase() : null;
  }

  function symbolMatches(data, ticker) {
    const symbol = normalizedSymbol(data);
    return Boolean(symbol) && symbol === ticker;
  }

  function parseTimestamp(data) {
    const value = findExplicitValue(data, FIELD_SETS.freshness);
    if (!hasSubstantiveValue(value)) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return { iso: parsed.toISOString(), ms: parsed.getTime() };
  }

  function validQuoteFreshness(data) {
    const timestamp = parseTimestamp(data);
    if (!timestamp) return { ready: false, timestamp: null, ageMs: null };
    const ageMs = Date.now() - timestamp.ms;
    if (ageMs < -5 * 60 * 1000) return { ready: false, timestamp, ageMs };
    return { ready: ageMs <= MAX_QUOTE_AGE_MS, timestamp, ageMs };
  }

  function validScore(value) {
    if (!isFiniteNumber(value)) return false;
    const score = Number(value);
    return score >= 0 && score <= 100;
  }

  async function getJson(url, timeoutMs = 18_000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store"
      });
      let data = null;
      try { data = await response.json(); } catch (_error) { data = null; }
      return { ok: response.ok, status: response.status, data };
    } catch (error) {
      return { ok: false, status: 0, data: null, error: error?.name || "network-error" };
    } finally {
      clearTimeout(timer);
    }
  }

  function ensurePanel(result) {
    let panel = document.querySelector("[data-current-rating-readiness]");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.className = "monster-current-readiness";
    panel.dataset.currentRatingReadiness = "";
    panel.setAttribute("aria-live", "polite");
    result.insertAdjacentElement("afterend", panel);
    if (!document.getElementById("monster-current-readiness-styles")) {
      const style = document.createElement("style");
      style.id = "monster-current-readiness-styles";
      style.textContent = `
        .monster-current-readiness{margin:0 auto 34px;max-width:1240px;padding:22px;border:1px solid rgba(255,255,255,.18);background:#101614;color:#fffaf0}
        .monster-current-readiness-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:start;margin-bottom:18px}
        .monster-current-readiness-kicker{margin:0 0 7px;color:var(--editorial-lime,#b8f34a);font-size:11px;font-weight:950;letter-spacing:.07em}
        .monster-current-readiness h3{margin:0;font-size:clamp(24px,3vw,40px);line-height:1}
        .monster-current-readiness-summary{margin:10px 0 0;max-width:820px;color:#cbd1cb;font-size:13px;line-height:1.55}
        .monster-current-readiness-state{min-width:190px;padding:12px 15px;border:1px solid #e44b38;background:#201412;color:#fff;text-align:center;font-size:12px;font-weight:950;line-height:1.3}
        .monster-current-readiness-state.ready{border-color:var(--editorial-lime,#b8f34a);background:#152011;color:var(--editorial-lime,#b8f34a)}
        .monster-current-readiness-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
        .monster-current-readiness-item{min-height:112px;padding:14px;border:1px solid rgba(255,255,255,.14);background:#171d1b}
        .monster-current-readiness-item strong{display:block;margin-bottom:8px;font-size:12px}
        .monster-current-readiness-item span{display:block;color:#aeb7b0;font-size:11px;line-height:1.4}
        .monster-current-readiness-item[data-ready="true"]{border-top:4px solid var(--editorial-lime,#b8f34a)}
        .monster-current-readiness-item[data-ready="false"]{border-top:4px solid #e44b38}
        .monster-current-readiness-source{margin:14px 0 0;color:#8f9991;font-size:10px;line-height:1.5}
        @media(max-width:1050px){.monster-current-readiness-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:900px){.monster-current-readiness-head{grid-template-columns:1fr}.monster-current-readiness-state{justify-self:start}.monster-current-readiness-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:560px){.monster-current-readiness{padding:16px}.monster-current-readiness-grid{grid-template-columns:1fr}}
      `;
      document.head.append(style);
    }
    return panel;
  }

  function renderLoading(panel, ticker) {
    panel.innerHTML = `<div class="monster-current-readiness-head"><div><p class="monster-current-readiness-kicker">CURRENT STOCK RATING™ READINESS · $${safe(ticker)}</p><h3>VERIFYING REQUIRED EVIDENCE</h3><p class="monster-current-readiness-summary">Checking identity, market quote, freshness, financial, risk, and versioned-calculation paths. No missing component will be guessed or filled with demonstration data.</p></div><div class="monster-current-readiness-state">CHECKING…</div></div>`;
  }

  function evidenceItem(label, ready, detail) {
    return `<div class="monster-current-readiness-item" data-ready="${ready ? "true" : "false"}"><strong>${safe(label)}</strong><span>${safe(detail)}</span></div>`;
  }

  async function verify(ticker, result, generation) {
    const base = apiBase();
    const panel = ensurePanel(result);
    renderLoading(panel, ticker);
    if (!base) {
      panel.innerHTML = `<div class="monster-current-readiness-head"><div><p class="monster-current-readiness-kicker">CURRENT STOCK RATING™ READINESS · $${safe(ticker)}</p><h3>DATA INCOMPLETE / NOT YET RATED</h3><p class="monster-current-readiness-summary">The public API base URL is not configured. A current rating cannot be calculated.</p></div><div class="monster-current-readiness-state">NOT YET RATED</div></div>`;
      return;
    }

    const encoded = encodeURIComponent(ticker);
    const [quote, fundamentals, analysis, sec] = await Promise.all([
      getJson(`${base}/api/stock-quote?symbol=${encoded}`),
      getJson(`${base}/api/fundamentals?symbol=${encoded}`),
      getJson(`${base}/api/stock-analysis?symbol=${encoded}`),
      getJson(`${base}/api/sec/company/${encoded}`, 65_000)
    ]);
    if (generation !== state.generation) return;

    const price = findExplicitValue(quote.data, FIELD_SETS.price);
    const freshness = validQuoteFreshness(quote.data);
    const financial = findExplicitValue(fundamentals.data, FIELD_SETS.financial);
    const risk = findExplicitValue(analysis.data, FIELD_SETS.risk);
    const score = findExplicitValue(analysis.data, FIELD_SETS.score);
    const version = findExplicitValue(analysis.data, FIELD_SETS.version);

    const checks = {
      sec: sec.ok && hasSubstantiveValue(sec.data) && symbolMatches(sec.data, ticker),
      quote: quote.ok && isFiniteNumber(price) && Number(price) > 0 && symbolMatches(quote.data, ticker),
      freshness: quote.ok && freshness.ready,
      financial: fundamentals.ok && hasSubstantiveValue(financial) && symbolMatches(fundamentals.data, ticker),
      risk: analysis.ok && hasSubstantiveValue(risk) && symbolMatches(analysis.data, ticker),
      versioned: analysis.ok && validScore(score) && hasSubstantiveValue(version) && symbolMatches(analysis.data, ticker)
    };

    const requiredReady = Object.values(checks).every(Boolean);
    const displayedScore = requiredReady ? Number(score) : null;
    const freshnessDetail = freshness.timestamp
      ? `${freshness.timestamp.iso}${freshness.ready ? " · within allowed freshness window" : " · stale or future-dated"}`
      : "Missing parseable quote/trade timestamp.";

    panel.innerHTML = `
      <div class="monster-current-readiness-head">
        <div>
          <p class="monster-current-readiness-kicker">CURRENT STOCK RATING™ READINESS · $${safe(ticker)}</p>
          <h3>${requiredReady ? `VERIFIED CURRENT RATING ${safe(displayedScore)}` : "DATA INCOMPLETE / NOT YET RATED"}</h3>
          <p class="monster-current-readiness-summary">${requiredReady ? `Every required evidence gate matches $${safe(ticker)} and passed fail-closed validation. Calculation version: ${safe(version)}.` : "A current numeric rating is deliberately withheld until every required evidence gate is present, ticker-matched, and fresh enough. Historical VCL™ demonstration scores never substitute for missing current evidence."}</p>
        </div>
        <div class="monster-current-readiness-state ${requiredReady ? "ready" : ""}">${requiredReady ? `RATING ${safe(displayedScore)}` : "NOT YET RATED"}</div>
      </div>
      <div class="monster-current-readiness-grid">
        ${evidenceItem("SEC IDENTITY", checks.sec, checks.sec ? `SEC response explicitly matches $${ticker}.` : `SEC identity missing or symbol mismatch (HTTP ${sec.status || "offline"}).`)}
        ${evidenceItem("MARKET QUOTE", checks.quote, checks.quote ? `Ticker-matched explicit price: ${price}` : `Missing positive ticker-matched price (HTTP ${quote.status || "offline"}).`)}
        ${evidenceItem("QUOTE FRESHNESS", checks.freshness, freshnessDetail)}
        ${evidenceItem("FINANCIAL EVIDENCE", checks.financial, checks.financial ? "Ticker-matched current financial field(s) received." : `Required ticker-matched financial evidence missing (HTTP ${fundamentals.status || "offline"}).`)}
        ${evidenceItem("RISK EVIDENCE", checks.risk, checks.risk ? "Ticker-matched risk field(s) received." : `Required ticker-matched risk evidence missing (HTTP ${analysis.status || "offline"}).`)}
        ${evidenceItem("VERSIONED CALCULATION", checks.versioned, checks.versioned ? `Score ${score} · version ${version}` : "No 0–100 score is accepted without an explicit version and ticker match.")}
      </div>
      <p class="monster-current-readiness-source">Required gates: SEC identity + positive current quote + fresh quote timestamp + current financial evidence + current risk evidence + versioned 0–100 calculation. Quote freshness is capped at 36 hours to survive weekends without accepting indefinitely stale data. Fail-closed means no manufactured number.</p>`;
  }

  const state = { generation: 0, timer: null };

  function scheduleVerify(input, result, delay = 80) {
    const ticker = String(input.value || "").trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,15}$/.test(ticker)) return;
    clearTimeout(state.timer);
    const generation = ++state.generation;
    state.timer = setTimeout(() => void verify(ticker, result, generation), delay);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const input = document.querySelector("[data-ticker-input]");
    const button = document.querySelector("[data-rate-button]");
    const result = document.querySelector("[data-result]");
    if (!input || !button || !result) return;
    button.addEventListener("click", () => scheduleVerify(input, result));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") scheduleVerify(input, result);
    });
    setTimeout(() => scheduleVerify(input, result, 0), 350);
  });
})();
