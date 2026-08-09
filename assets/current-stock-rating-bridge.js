// TS: 2026-08-09 10:02 ET

(() => {
  "use strict";

  const applied = new Map();

  function text(node) {
    return String(node?.textContent ?? "").trim();
  }

  function tickerFromResult(result) {
    const node = result.querySelector(".monster-result-identity h2 span, .monster-launch-summary h2 span");
    return window.NYM_PRODUCTION_RATING?.normalizeSymbol?.(text(node)) ?? "";
  }

  function applyEligible(card, ticker, rating) {
    const value = card.querySelector("strong");
    const status = card.querySelector("em");
    const copy = card.querySelector("p");
    if (!value || !status || !copy) return;

    value.textContent = String(Math.round(Number(rating.score)));
    status.textContent = `${String(rating.tier ?? "VERIFIED").toUpperCase()} · CURRENT STOCK RATING™`;
    copy.textContent = String(rating.summary || `Verified production rating calculated with ${rating.engineVersion}.`);
    card.dataset.productionRatingStatus = "eligible";
    card.dataset.productionRatingEngine = String(rating.engineVersion);
    card.setAttribute("aria-label", `Verified Current Stock Rating for ${ticker}: ${Math.round(Number(rating.score))}`);
  }

  function applyIneligible(card, ticker, rating) {
    const value = card.querySelector("strong");
    const status = card.querySelector("em");
    const copy = card.querySelector("p");
    if (!value || !status || !copy) return;

    value.textContent = "DATA INCOMPLETE";
    status.textContent = `CURRENT STOCK RATING™ · ${String(rating.summary || "NOT YET RATED").toUpperCase()}`;
    const firstReason = Array.isArray(rating.reasons) ? rating.reasons[0]?.message : "";
    copy.textContent = String(firstReason || "The production engine returned an explicit ineligible result, so no numeric Current Stock Rating™ is published.");
    card.dataset.productionRatingStatus = "ineligible";
    card.dataset.productionRatingEngine = String(rating.engineVersion ?? "");
    card.setAttribute("aria-label", `Current Stock Rating not yet rated for ${ticker}`);
  }

  async function update(result) {
    if (!result?.firstElementChild || getComputedStyle(result).display === "none") return;
    const ticker = tickerFromResult(result);
    const card = result.querySelector(".monster-rating-trio-card:first-child");
    const client = window.NYM_PRODUCTION_RATING;
    if (!ticker || !card || !client?.fetchRating) return;

    if (applied.get(ticker) === card && card.dataset.productionRatingStatus) return;
    const response = await client.fetchRating(ticker);
    if (tickerFromResult(result) !== ticker) return;

    if (response?.status !== "ok" || !response.data) {
      card.dataset.productionRatingStatus = response?.status || "unavailable";
      applied.set(ticker, card);
      return;
    }

    if (response.data.eligible === true && Number.isFinite(Number(response.data.score))) {
      applyEligible(card, ticker, response.data);
    } else {
      applyIneligible(card, ticker, response.data);
    }
    applied.set(ticker, card);
  }

  function start() {
    if (!/\/monster-check\.html$/i.test(window.location.pathname)) return;
    const result = document.querySelector("[data-result]");
    if (!result) return;

    let frame = 0;
    const rerun = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => update(result));
    };

    new MutationObserver(rerun).observe(result, { childList: true, subtree: true });
    rerun();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
