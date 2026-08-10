// TS: 2026-08-10 11:14 ET

(() => {
  "use strict";

  const MAX_QUOTE_AGE_MS = 36 * 60 * 60 * 1000;
  const MAX_SEC_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

  const REQUIRED_INPUTS = [
    { key: "identity", label: "Official SEC company identity" },
    { key: "filing", label: "Latest official SEC filing" },
    { key: "quote", label: "Current market quote" },
    { key: "freshness", label: "Quote freshness / provider timestamp" },
    { key: "financials", label: "Verified current financial evidence" },
    { key: "risk", label: "Verified current risk evidence" },
    { key: "calculation", label: "Versioned Current Stock Rating™ calculation" },
  ];

  const ratingResults = new Map();
  const ratingRequests = new Map();
  let clientPromise = null;

  function text(node) {
    return String(node?.textContent ?? "").trim();
  }

  function normalizeTicker(value) {
    return String(value ?? "").trim().toUpperCase().replace(/^\$/, "");
  }

  function parseTimestamp(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function timestampIsCurrent(value, maxAgeMs) {
    const parsed = parseTimestamp(value);
    if (parsed === null) return false;
    const ageMs = Date.now() - parsed;
    return ageMs >= -FUTURE_TOLERANCE_MS && ageMs <= maxAgeMs;
  }

  function isUnavailable(value) {
    const normalized = String(value ?? "").trim().toUpperCase();
    return !normalized || [
      "CONNECTING…",
      "CONNECTING...",
      "UNAVAILABLE",
      "NOT CONNECTED",
      "MARKET DATA NOT CONNECTED",
      "CHECKING PROVIDER…",
      "CHECKING PROVIDER...",
      "CHECKING EDGAR…",
      "CHECKING EDGAR...",
      "SEC CONNECTION UNAVAILABLE",
      "NO RECENT FILING RETURNED",
      "STALE",
    ].some((token) => normalized.includes(token));
  }

  function ensureClient() {
    if (window.NYM_PRODUCTION_RATING?.fetchRating) return Promise.resolve(window.NYM_PRODUCTION_RATING);
    if (clientPromise) return clientPromise;

    clientPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-production-rating-client]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.NYM_PRODUCTION_RATING ?? null), { once: true });
        existing.addEventListener("error", () => resolve(null), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "assets/production-rating-client.js";
      script.async = true;
      script.dataset.productionRatingClient = "";
      script.addEventListener("load", () => resolve(window.NYM_PRODUCTION_RATING ?? null), { once: true });
      script.addEventListener("error", () => resolve(null), { once: true });
      document.head.appendChild(script);
    });

    return clientPromise;
  }

  function machineEvidence(payload, ticker) {
    if (!payload || typeof payload !== "object") {
      return { filing: false, quote: false, freshness: false, financials: false, risk: false, calculation: false };
    }

    const expectedTicker = normalizeTicker(ticker);
    if (normalizeTicker(payload.symbol) !== expectedTicker) {
      return { filing: false, quote: false, freshness: false, financials: false, risk: false, calculation: false };
    }

    const inputs = Array.isArray(payload.evidenceInputs) ? payload.evidenceInputs : [];
    const components = Array.isArray(payload.components) ? payload.components : [];
    const marketEvidence = inputs.filter((item) => item?.sourceType === "market-data" && item?.value !== null && item?.value !== undefined);
    const filingEvidence = inputs.filter((item) => item?.sourceType === "sec-filing" && item?.value !== null && item?.value !== undefined);
    const financialEvidence = inputs.filter((item) => ["sec-filing", "company-fact"].includes(item?.sourceType) && item?.value !== null && item?.value !== undefined);
    const riskComponent = components.find((item) => item?.key === "risk_deterioration");

    const filing = filingEvidence.some((item) =>
      String(item?.sourceUrl ?? "").startsWith("https://www.sec.gov/") &&
      (!item?.sourceTimestamp || timestampIsCurrent(item.sourceTimestamp, MAX_SEC_AGE_MS))
    );

    const quote = marketEvidence.some((item) =>
      Number.isFinite(Number(item?.value)) && Number(item.value) > 0 && String(item?.provider ?? item?.source ?? "").trim()
    );

    const freshness = marketEvidence.some((item) => timestampIsCurrent(item?.sourceTimestamp, MAX_QUOTE_AGE_MS));

    const financials = financialEvidence.some((item) =>
      String(item?.sourceUrl ?? "").startsWith("https://") &&
      (!item?.sourceTimestamp || timestampIsCurrent(item.sourceTimestamp, MAX_SEC_AGE_MS))
    );

    const risk = Boolean(
      riskComponent &&
      riskComponent.direction !== "unavailable" &&
      Number.isFinite(Number(riskComponent.score))
    );

    const calculation = Boolean(
      String(payload.engineVersion ?? "").trim() &&
      timestampIsCurrent(payload.calculatedAt, MAX_QUOTE_AGE_MS) &&
      typeof payload.eligible === "boolean" &&
      (payload.eligible
        ? Number.isFinite(Number(payload.score)) && Number(payload.score) >= 0 && Number(payload.score) <= 100
        : payload.score === null && String(payload.eligibilityCode ?? "").trim())
    );

    return { filing, quote, freshness, financials, risk, calculation };
  }

  function inspect(result, ticker) {
    const flag = text(result.querySelector(".monster-demo-flag"));
    const officialIdentity = flag.includes("OFFICIAL SEC COMPANY RECORD");

    const filingForm = text(result.querySelector("[data-live-filing-form]"));
    const filingLink = result.querySelector("[data-live-filing-link][href]");
    const filing = Boolean(filingLink) && !isUnavailable(filingForm);

    const quoteText = text(result.querySelector("[data-live-price]"));
    const quote = !isUnavailable(quoteText) && /\d/.test(quoteText);

    const freshnessText = text(result.querySelector("[data-live-freshness]"));
    const timeText = text(result.querySelector("[data-live-time]"));
    const freshness = quote && !isUnavailable(freshnessText) && !isUnavailable(timeText);

    const machine = machineEvidence(ratingResults.get(ticker)?.data, ticker);

    return {
      identity: officialIdentity,
      filing: filing || machine.filing,
      quote: quote || machine.quote,
      freshness: freshness || machine.freshness,
      financials: machine.financials,
      risk: machine.risk,
      calculation: machine.calculation,
    };
  }

  function requestProductionRating(ticker, result) {
    if (ratingResults.has(ticker) || ratingRequests.has(ticker)) return;

    const pending = ensureClient()
      .then((client) => client?.fetchRating ? client.fetchRating(ticker) : { status: "unavailable", symbol: ticker, data: null })
      .then((response) => {
        ratingResults.set(ticker, response);
        ratingRequests.delete(ticker);
        render(result);
      })
      .catch(() => {
        ratingResults.set(ticker, { status: "unavailable", symbol: ticker, data: null });
        ratingRequests.delete(ticker);
        render(result);
      });

    ratingRequests.set(ticker, pending);
  }

  function syncCurrentRatingCard(result, ticker) {
    const card = result.querySelector(".monster-rating-trio-card:first-child");
    const response = ratingResults.get(ticker);
    if (!card || response?.status !== "ok" || !response.data) return;

    const rating = response.data;
    const machine = machineEvidence(rating, ticker);
    const machineComplete = [machine.filing, machine.quote, machine.freshness, machine.financials, machine.risk, machine.calculation].every(Boolean);
    const value = card.querySelector("strong");
    const status = card.querySelector("em");
    const copy = card.querySelector("p");
    if (!value || !status || !copy) return;

    if (rating.eligible === true && Number.isFinite(Number(rating.score)) && machineComplete) {
      const score = Math.round(Number(rating.score));
      value.textContent = String(score);
      status.textContent = `${String(rating.tier ?? "VERIFIED").toUpperCase()} · CURRENT STOCK RATING™`;
      copy.textContent = String(rating.summary || `Verified production rating calculated with ${rating.engineVersion}.`);
      card.dataset.productionRatingStatus = "eligible";
      card.dataset.productionRatingEngine = String(rating.engineVersion);
      card.setAttribute("aria-label", `Verified Current Stock Rating for ${ticker}: ${score}`);
      return;
    }

    value.textContent = "DATA INCOMPLETE";
    status.textContent = "CURRENT STOCK RATING™ · NOT YET RATED";
    const firstReason = Array.isArray(rating.reasons) ? rating.reasons[0]?.message : "";
    copy.textContent = String(
      firstReason ||
      (rating.eligible === true
        ? "A numeric production result was withheld because one or more required machine-readable evidence gates could not be independently verified in the returned payload."
        : "The production engine returned an explicit ineligible result, so no numeric Current Stock Rating™ is published.")
    );
    card.dataset.productionRatingStatus = "ineligible";
    card.dataset.productionRatingEngine = String(rating.engineVersion ?? "");
    card.setAttribute("aria-label", `Current Stock Rating not yet rated for ${ticker}`);
  }

  function injectStyles() {
    if (document.getElementById("current-stock-readiness-styles")) return;
    const style = document.createElement("style");
    style.id = "current-stock-readiness-styles";
    style.textContent = `
      .current-stock-readiness{margin:0 0 24px;padding:20px;border:1px solid rgba(255,255,255,.18);background:#0d1210;color:#fffaf0}
      .current-stock-readiness-head{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;justify-content:space-between;margin-bottom:16px}
      .current-stock-readiness-kicker{display:block;margin-bottom:7px;color:#aeb6af;font-size:9px;font-weight:950;letter-spacing:.07em}
      .current-stock-readiness h3{margin:0;color:#fffaf0;font-size:clamp(22px,2.5vw,34px);line-height:1}
      .current-stock-readiness-summary{display:block;padding:8px 11px;border:1px solid rgba(217,170,49,.55);color:#f0c95a;font-size:10px;font-weight:950;letter-spacing:.045em}
      .current-stock-readiness-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none}
      .current-stock-readiness-grid li{display:flex;gap:9px;align-items:flex-start;padding:10px 12px;background:#151b18;color:#d6dbd5;font-size:11px;line-height:1.35}
      .current-stock-readiness-grid b{flex:0 0 auto;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:10px}
      .current-stock-readiness-grid .is-ready b{background:#b8f34a;color:#0a0e0c}
      .current-stock-readiness-grid .is-missing b{background:#342520;color:#f0c95a}
      .current-stock-readiness-note{margin:14px 0 0;color:#aeb6af;font-size:11px;line-height:1.5}
      @media(max-width:720px){.current-stock-readiness-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function render(result) {
    if (!result?.firstElementChild || getComputedStyle(result).display === "none") return;

    const tickerNode = result.querySelector(".monster-result-identity h2 span, .monster-launch-summary h2 span");
    const ticker = normalizeTicker(text(tickerNode));
    if (!ticker || !/^[A-Z0-9.-]{1,15}$/.test(ticker)) return;

    requestProductionRating(ticker, result);
    syncCurrentRatingCard(result, ticker);

    const state = inspect(result, ticker);
    const completeCount = REQUIRED_INPUTS.filter((item) => state[item.key]).length;
    const ready = completeCount === REQUIRED_INPUTS.length;
    const ratingState = ratingResults.get(ticker);
    const machineStatus = ratingState?.status ?? (ratingRequests.has(ticker) ? "loading" : "idle");
    const signature = `${ticker}|${REQUIRED_INPUTS.map((item) => state[item.key] ? "1" : "0").join("")}|${machineStatus}`;

    let panel = result.querySelector(":scope .current-stock-readiness");
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "current-stock-readiness";
      const trio = result.querySelector(".monster-rating-trio");
      if (trio) trio.insertAdjacentElement("afterend", panel);
      else result.prepend(panel);
    }

    if (panel.dataset.readinessSignature === signature) return;
    panel.dataset.readinessSignature = signature;
    panel.setAttribute("aria-label", `Current Stock Rating readiness for ${ticker}`);
    panel.innerHTML = `
      <div class="current-stock-readiness-head">
        <div>
          <span class="current-stock-readiness-kicker">CURRENT STOCK RATING™ / REQUIRED EVIDENCE</span>
          <h3>${ready ? "VERIFIED RATING INPUTS COMPLETE" : "DATA INCOMPLETE / NOT YET RATED"}</h3>
        </div>
        <strong class="current-stock-readiness-summary">${completeCount} / ${REQUIRED_INPUTS.length} VERIFIED INPUTS PRESENT</strong>
      </div>
      <ul class="current-stock-readiness-grid">
        ${REQUIRED_INPUTS.map((item) => {
          const present = Boolean(state[item.key]);
          return `<li class="${present ? "is-ready" : "is-missing"}"><b>${present ? "✓" : "!"}</b><span>${item.label}<br><small>${present ? "VERIFIED IN THIS RESULT" : "REQUIRED BEFORE A CURRENT SCORE CAN BE PUBLISHED"}</small></span></li>`;
        }).join("")}
      </ul>
      <p class="current-stock-readiness-note">A numeric Current Stock Rating™ is shown only when the production payload itself independently proves the required filing, market, freshness, financial, risk, and versioned-calculation evidence. SEC identity, a filing, a quote, or an optimistic payload flag alone cannot create a score.</p>
    `;
  }

  function start() {
    if (!/\/monster-check\.html$/i.test(window.location.pathname)) return;
    injectStyles();

    const result = document.querySelector("[data-result]");
    if (!result) return;

    let frame = 0;
    const rerender = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => render(result));
    };

    new MutationObserver(rerender).observe(result, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["href", "data-live-status"],
    });

    rerender();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();