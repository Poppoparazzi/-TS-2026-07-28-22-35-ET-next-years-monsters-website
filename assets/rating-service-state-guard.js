// TS: 2026-08-13 10:08 ET

(() => {
  "use strict";

  const PENDING_HEADING = "PRODUCTION RATING SERVICE UPDATE PENDING";
  const PENDING_STATUS = "CURRENT STOCK RATING™ · DATA INCOMPLETE";
  const PENDING_COPY = "The production rating service has not yet published the current rating route. No ticker-specific conclusion or numeric score is being inferred while that service update is pending.";

  function rewriteStaleRouteState(root = document) {
    root.querySelectorAll(".current-stock-readiness").forEach((panel) => {
      const heading = panel.querySelector("h3");
      const summary = panel.querySelector(".current-stock-readiness-summary");
      const note = panel.querySelector(".current-stock-readiness-note");
      if (!heading || heading.textContent.trim() !== "CURRENT RATING NOT AVAILABLE FOR THIS TICKER") return;

      heading.textContent = PENDING_HEADING;
      if (summary) summary.textContent = "SERVICE UPDATE PENDING";
      if (note) note.textContent = PENDING_COPY;
      panel.dataset.ratingServiceState = "update-pending";
    });

    root.querySelectorAll(".monster-rating-trio-card:first-child").forEach((card) => {
      if (card.dataset.productionRatingStatus !== "not_found") return;
      const value = card.querySelector("strong");
      const status = card.querySelector("em");
      const copy = card.querySelector("p");
      if (value) value.textContent = "DATA INCOMPLETE";
      if (status) status.textContent = PENDING_STATUS;
      if (copy) copy.textContent = PENDING_COPY;
      card.dataset.productionRatingStatus = "service-update-pending";
      card.setAttribute("aria-label", PENDING_STATUS);
    });
  }

  function start() {
    if (!/\/monster-check\.html$/i.test(window.location.pathname)) return;
    const result = document.querySelector("[data-result]");
    if (!result) return;

    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => rewriteStaleRouteState(result));
    };

    new MutationObserver(sync).observe(result, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-production-rating-status"],
    });

    sync();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
