// TS: 2026-08-21 17:08 UTC

(function installCurrentRatingReadiness() {
  "use strict";

  const page = (window.location.pathname || "").split("/").filter(Boolean).pop();
  if (page && page !== "monster-check.html") return;

  const MAX_QUOTE_AGE_MS = 36 * 60 * 60 * 1000;
  const MAX_SEC_FACT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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

  function normalized(value) {
    return typeof value === "string" ? value.trim().toUpperCase() : "";
  }

  function positiveFinite(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  }

  function parseIso(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? { iso: new Date(ms).toISOString(), ms } : null;
  }

  function freshness(timestamp, maximumAgeMs) {
    const parsed = parseIso(timestamp);
    if (!parsed) return { ready: false, parsed: null, ageMs: null };
    const ageMs = Date.now() - parsed.ms;
    if (ageMs < -5 * 60 * 1000) return { ready: false, parsed, ageMs };
    return { ready: ageMs <= maximumAgeMs, parsed, ageMs };
  }

  function quoteContract(data, ticker) {
    if (!data || typeof data !== "object") return { ready: false, reason: "Missing quote payload." };
    if (normalized(data.symbol) !== ticker) return { ready: false, reason: "Quote symbol does not match the requested ticker." };
    if (!positiveFinite(data.price)) return { ready: false, reason: "Quote does not contain a positive numeric price." };
    if (typeof data.provider !== "string" || !data.provider.trim()) return { ready: false, reason: "Quote provider provenance is missing." };
    if (typeof data.freshness !== "string" || !data.freshness.trim() || data.freshness === "unavailable") {
      return { ready: false, reason: "Quote freshness classification is unavailable." };
    }
    const observed = freshness(data.providerTimestamp, MAX_QUOTE_AGE_MS);
    const retrieved = freshness(data.retrievedAt, MAX_QUOTE_AGE_MS);
    if (!observed.ready || !retrieved.ready) return { ready: false, reason: "Quote observation or retrieval timestamp is stale, invalid, or future-dated.", observed, retrieved };
    if (observed.parsed.ms > retrieved.parsed.ms + 5 * 60 * 1000) {
      return { ready: false, reason: "Quote observation timestamp occurs after its retrieval timestamp.", observed, retrieved };
    }
    return { ready: true, data, observed, retrieved };
  }

  function secIdentityContract(data, ticker) {
    if (!data || typeof data !== "object") return { ready: false, reason: "Missing SEC company payload." };
    if (normalized(data.ticker) !== ticker) return { ready: false, reason: "SEC company ticker does not match the requested ticker." };
    if (!Number.isInteger(data.cik) || data.cik <= 0) return { ready: false, reason: "Verified SEC CIK is missing." };
    if (typeof data.sourceUrl !== "string" || !data.sourceUrl.startsWith("https://www.sec.gov/")) {
      return { ready: false, reason: "SEC company source provenance is missing or unsupported." };
    }
    return { ready: true, data };
  }

  function secFactsContract(data, ticker) {
    if (!data || typeof data !== "object") return { ready: false, reason: "Missing SEC company-facts payload." };
    if (normalized(data.ticker) !== ticker) return { ready: false, reason: "SEC facts ticker does not match the requested ticker." };
    if (!Number.isInteger(data.cik) || data.cik <= 0) return { ready: false, reason: "SEC facts CIK is missing." };
    if (typeof data.sourceUrl !== "string" || !data.sourceUrl.startsWith("https://data.sec.gov/")) {
      return { ready: false, reason: "SEC facts source provenance is missing or unsupported." };
    }
    if (!data.facts || typeof data.facts !== "object" || Array.isArray(data.facts) || Object.keys(data.facts).length === 0) {
      return { ready: false, reason: "No machine-readable SEC financial facts were returned." };
    }
    const retrieved = freshness(data.retrievedAt, MAX_SEC_FACT_AGE_MS);
    if (!retrieved.ready) return { ready: false, reason: "SEC financial evidence is stale, invalid, or future-dated.", retrieved };
    return { ready: true, data, retrieved };
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
    panel.innerHTML = `<div class="monster-current-readiness-head"><div><p class="monster-current-readiness-kicker">CURRENT STOCK RATING™ READINESS · $${safe(ticker)}</p><h3>VERIFYING REQUIRED EVIDENCE</h3><p class="monster-current-readiness-summary">Checking the exact public API contracts for SEC identity, current quote, quote freshness, and SEC financial evidence. Risk evidence and a versioned Current Stock Rating™ calculation must also exist before any numeric rating can be shown.</p></div><div class="monster-current-readiness-state">CHECKING…</div></div>`;
  }

  function evidenceItem(label, ready, detail) {
    return `<div class="monster-current-readiness-item" data-ready="${ready ? "true" : "false"}"><strong>${safe(label)}</strong><span>${safe(detail)}</span></div>`;
  }

  async function verify(ticker, result, generation) {
    const base = apiBase();
    const panel = ensurePanel(result);
    renderLoading(panel, ticker);
    if (!base) {
      panel.innerHTML = `<div class="monster-current-readiness-head"><div><p class="monster-current-readiness-kicker">CURRENT STOCK RATING™ READINESS · $${safe(ticker)}</p><h3>NOT YET RATED — STAY TUNED</h3><p class="monster-current-readiness-summary">Coming Soon. The public API base URL is not configured, so a current rating cannot yet be calculated.</p></div><div class="monster-current-readiness-state">NOT YET RATED</div></div>`;
      return;
    }

    const encoded = encodeURIComponent(ticker);
    const [quoteResponse, secResponse, factsResponse, providerResponse] = await Promise.all([
      getJson(`${base}/api/quotes/${encoded}`),
      getJson(`${base}/api/sec/company/${encoded}`, 65_000),
      getJson(`${base}/api/sec/facts/${encoded}`, 65_000),
      getJson(`${base}/api/provider-status`)
    ]);
    if (generation !== state.generation) return;

    const quote = quoteResponse.ok ? quoteContract(quoteResponse.data, ticker) : { ready: false, reason: `Quote endpoint returned HTTP ${quoteResponse.status || "offline"}.` };
    const sec = secResponse.ok ? secIdentityContract(secResponse.data, ticker) : { ready: false, reason: `SEC company endpoint returned HTTP ${secResponse.status || "offline"}.` };
    const facts = factsResponse.ok ? secFactsContract(factsResponse.data, ticker) : { ready: false, reason: `SEC facts endpoint returned HTTP ${factsResponse.status || "offline"}.` };
    const marketProviderConfigured = Boolean(providerResponse.ok && providerResponse.data?.marketData?.configured === true);

    const checks = {
      sec: sec.ready,
      quote: quote.ready && marketProviderConfigured,
      freshness: quote.ready,
      financial: facts.ready,
      risk: false,
      versioned: false
    };

    const requiredReady = Object.values(checks).every(Boolean);
    const quoteDetail = quote.ready
      ? `${quote.data.provider} · ${quote.data.price} ${quote.data.currency || ""} · ${quote.data.freshness}`.trim()
      : quote.reason;
    const freshnessDetail = quote.ready
      ? `Observed ${quote.observed.parsed.iso} · retrieved ${quote.retrieved.parsed.iso}`
      : quote.reason;
    const factsDetail = facts.ready
      ? `${Object.keys(facts.data.facts).length} SEC fact series · retrieved ${facts.retrieved.parsed.iso}`
      : facts.reason;

    panel.innerHTML = `
      <div class="monster-current-readiness-head">
        <div>
          <p class="monster-current-readiness-kicker">CURRENT STOCK RATING™ READINESS · $${safe(ticker)}</p>
          <h3>${requiredReady ? "VERIFIED CURRENT RATING" : "NOT YET RATED — STAY TUNED"}</h3>
          <p class="monster-current-readiness-summary">${requiredReady ? "Every required evidence gate passed the exact backend contract." : "Coming Soon. The system is checking the supported evidence fields and will publish a number only after every required rating gate passes."}</p>
        </div>
        <div class="monster-current-readiness-state">${requiredReady ? "READY" : "NOT YET RATED"}</div>
      </div>
      <div class="monster-current-readiness-grid">
        ${evidenceItem("SEC IDENTITY", checks.sec, checks.sec ? `SEC CIK ${sec.data.cik} explicitly matches $${ticker}.` : sec.reason)}
        ${evidenceItem("MARKET QUOTE", checks.quote, marketProviderConfigured ? quoteDetail : "Market-data provider is not configured on the public API.")}
        ${evidenceItem("QUOTE FRESHNESS", checks.freshness, freshnessDetail)}
        ${evidenceItem("FINANCIAL EVIDENCE", checks.financial, factsDetail)}
        ${evidenceItem("RISK EVIDENCE", false, "No supported public machine-readable risk-evidence endpoint exists yet. This gate fails closed.")}
        ${evidenceItem("VERSIONED CALCULATION", false, "No supported public versioned Current Stock Rating™ endpoint exists yet. No score is manufactured from demo data.")}
      </div>
      <p class="monster-current-readiness-source">Exact live routes checked: /api/quotes/:symbol, /api/sec/company/:symbol, /api/sec/facts/:symbol, and /api/provider-status. The earlier guessed /api/stock-quote, /api/fundamentals, and /api/stock-analysis paths are no longer used.</p>`;
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
