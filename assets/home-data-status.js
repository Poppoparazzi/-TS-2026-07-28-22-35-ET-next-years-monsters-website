// TS: 2026-08-04 14:34 ET

(function initializeHomeDataStatus() {
  "use strict";

  const status = document.querySelector("[data-home-sec-status]");
  const apiBaseUrl = window.NYM_CONFIG?.apiBaseUrl?.replace(/\/$/, "") ?? "";

  if (!status) return;

  if (!apiBaseUrl) {
    status.textContent = "PROVIDER NOT CONNECTED";
    status.dataset.state = "unavailable";
    return;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 65_000);

  fetch(`${apiBaseUrl}/api/health`, {
    headers: { Accept: "application/json" },
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Health check returned HTTP ${response.status}.`);
      return response.json();
    })
    .then((health) => {
      const connected = health?.status === "ok" && health?.sec?.configured === true;
      status.textContent = connected
        ? "OFFICIAL SEC EVIDENCE · CONNECTED"
        : "PROVIDER NOT CONNECTED";
      status.dataset.state = connected ? "connected" : "unavailable";
    })
    .catch(() => {
      status.textContent = "PROVIDER NOT CONNECTED";
      status.dataset.state = "unavailable";
    })
    .finally(() => window.clearTimeout(timeout));
})();
