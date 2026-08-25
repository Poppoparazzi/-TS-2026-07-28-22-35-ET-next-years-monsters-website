// TS: 2026-08-25 00:00 ET

(function initializeHomeDataStatus() {
  "use strict";

  const secStatus = document.querySelector("[data-home-sec-status]");
  const ratingStatus = Array.from(document.querySelectorAll("[data-home-data-status] .home-data-status-item"))
    .find((item) => item.querySelector("span")?.textContent?.trim() === "MONSTER RATINGS™")
    ?.querySelector("strong");
  const apiBaseUrl = window.NYM_CONFIG?.apiBaseUrl?.replace(/\/$/, "") ?? "";

  if (!secStatus && !ratingStatus) return;

  if (!apiBaseUrl) {
    if (secStatus) {
      secStatus.textContent = "NOT CONFIGURED";
      secStatus.dataset.state = "unavailable";
    }
    if (ratingStatus) {
      ratingStatus.textContent = "TEMPORARILY UNAVAILABLE · 15 DEMONSTRATIONS";
      ratingStatus.dataset.state = "unavailable";
    }
    return;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 65_000);

  const healthRequest = fetch(`${apiBaseUrl}/api/health`, {
    headers: { Accept: "application/json" },
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Health check returned HTTP ${response.status}.`);
      return response.json();
    })
    .then((health) => {
      if (!secStatus) return;
      const connected = health?.status === "ok" && health?.sec?.configured === true;
      secStatus.textContent = connected ? "OFFICIAL SEC · CONNECTED" : "TEMPORARILY UNAVAILABLE";
      secStatus.dataset.state = connected ? "connected" : "unavailable";
    })
    .catch(() => {
      if (!secStatus) return;
      secStatus.textContent = "TEMPORARILY UNAVAILABLE";
      secStatus.dataset.state = "unavailable";
    });

  const ratingRequest = fetch(`${apiBaseUrl}/api/universe/status?limit=1`, {
    headers: { Accept: "application/json" },
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Universe status returned HTTP ${response.status}.`);
      return response.json();
    })
    .then((universe) => {
      if (!ratingStatus) return;
      const verified = Number(universe?.ratingCompleteCount);
      if (!Number.isFinite(verified) || verified < 0) {
        throw new Error("Universe status did not provide a valid ratingCompleteCount.");
      }
      ratingStatus.textContent = `${Math.trunc(verified).toLocaleString("en-US")} VERIFIED · 15 DEMONSTRATIONS`;
      ratingStatus.dataset.state = "connected";
    })
    .catch(() => {
      if (!ratingStatus) return;
      ratingStatus.textContent = "TEMPORARILY UNAVAILABLE · 15 DEMONSTRATIONS";
      ratingStatus.dataset.state = "unavailable";
    });

  Promise.allSettled([healthRequest, ratingRequest])
    .finally(() => window.clearTimeout(timeout));
})();
