// TS: 2026-08-13 16:59 ET

(function showProductionRatingServiceState() {
  const apiBaseUrl = String(window.NYM_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");
  const statusBox = document.querySelector(".status-next");
  if (!apiBaseUrl || !statusBox) return;

  const line = document.createElement("span");
  line.setAttribute("data-rating-service-live-state", "");
  line.textContent = "Checking the production Current Stock Rating™ service…";
  statusBox.appendChild(line);

  async function check() {
    try {
      const response = await fetch(`${apiBaseUrl}/api/ratings/AAPL?status_probe=${Date.now()}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (response.ok) {
        line.textContent = "CURRENT STOCK RATING™ SERVICE: API ROUTE RESPONDING · ratings remain evidence-gated.";
        line.dataset.state = "ready";
        return;
      }

      if (response.status === 404) {
        line.textContent = "CURRENT STOCK RATING™ SERVICE: PRODUCTION UPDATE PENDING · no numeric rating is being inferred.";
        line.dataset.state = "pending";
        return;
      }

      line.textContent = `CURRENT STOCK RATING™ SERVICE: DATA INCOMPLETE · production API returned HTTP ${response.status}.`;
      line.dataset.state = "incomplete";
    } catch {
      line.textContent = "CURRENT STOCK RATING™ SERVICE: DATA INCOMPLETE · production API could not be verified.";
      line.dataset.state = "incomplete";
    }
  }

  check();
})();
