// TS: 2026-08-05 07:36 UTC

(() => {
  "use strict";

  const config = window.NYM_CONFIG ?? {};
  const PUBLIC_LIMIT = 2000;
  let requestInFlight = false;
  let lastValidSnapshot = null;

  function apiBaseUrl() {
    const raw = typeof config.apiBaseUrl === "string" ? config.apiBaseUrl.trim() : "";
    if (!raw) return null;
    try {
      const url = new URL(raw);
      const localDevelopment = ["localhost", "127.0.0.1"].includes(url.hostname);
      if (url.protocol !== "https:" && !localDevelopment) return null;
      return url.href.replace(/\/$/, "");
    } catch (_error) {
      return null;
    }
  }

  function setText(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = String(value);
  }

  function setRefreshState(disabled, label) {
    const button = document.querySelector("[data-status-refresh]");
    if (!button) return;
    button.disabled = disabled;
    button.textContent = label;
  }

  function nonNegativeInteger(value, label) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) {
      throw new Error(`${label} is missing or invalid.`);
    }
    return number;
  }

  async function requestJson(url) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(65_000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("The API returned an invalid response.");
    }
    return payload;
  }

  function normalizeSnapshot(health, universe) {
    const snapshot = {
      version: typeof health.version === "string" && health.version.trim() ? health.version.trim() : "UNKNOWN",
      databaseConnected: Boolean(health?.database?.configured),
      secConnected: Boolean(health?.sec?.configured),
      universeConnected: Boolean(health?.universe?.configured),
      universeSize: nonNegativeInteger(universe.universeSize, "Universe size"),
      examined: nonNegativeInteger(universe.examinedCount, "Examined count"),
      complete: nonNegativeInteger(universe.secCompleteCount, "SEC-complete count"),
      unresolved: nonNegativeInteger(universe.unresolvedCount, "Unresolved count"),
      queued: nonNegativeInteger(universe.queuedCount, "Queued count"),
      processing: nonNegativeInteger(universe.processingCount, "Processing count"),
      failed: nonNegativeInteger(universe.failedCount, "Failed count"),
      quotes: nonNegativeInteger(universe.quoteCompleteCount, "Quote count"),
      ratings: nonNegativeInteger(universe.ratingCompleteCount, "Rating count"),
    };

    if (snapshot.examined > snapshot.universeSize) {
      throw new Error("Examined count exceeds the active universe.");
    }
    if (snapshot.complete + snapshot.unresolved + snapshot.queued + snapshot.processing + snapshot.failed > snapshot.universeSize) {
      throw new Error("Factory totals exceed the active universe.");
    }
    if (snapshot.quotes > snapshot.universeSize || snapshot.ratings > snapshot.universeSize) {
      throw new Error("Quote or rating totals exceed the active universe.");
    }
    return snapshot;
  }

  function renderUnavailable(message) {
    if (!lastValidSnapshot) {
      ["[data-universe-count]", "[data-examined-count]", "[data-sec-complete-count]", "[data-unresolved-count]", "[data-quote-count]", "[data-rating-count]"].forEach((selector) => setText(selector, "—"));
      setText("[data-api-version]", "UNAVAILABLE");
      setText("[data-database-status]", "UNKNOWN");
      setText("[data-sec-provider-status]", "UNKNOWN");
    }
    setText("[data-production-headline]", lastValidSnapshot ? "REFRESH FAILED · LAST VALID COUNTS PRESERVED" : "PROVIDER NOT CONNECTED");
    setText("[data-production-message]", `${message} No zero or completion claim was substituted.`);
    if (!lastValidSnapshot) {
      setText("[data-database-detail]", "Provider Not Connected. PostgreSQL status could not be confirmed.");
      setText("[data-sec-detail]", "Provider Not Connected. Official SEC Evidence status could not be confirmed.");
      setText("[data-queue-detail]", "Queue, processing, and failure totals could not be verified.");
      setText("[data-public-detail]", "Public-universe totals could not be verified.");
    }
  }

  function renderProduction(snapshot) {
    lastValidSnapshot = snapshot;
    setText("[data-api-version]", snapshot.version);
    setText("[data-database-status]", snapshot.databaseConnected ? "CONNECTED" : "PROVIDER NOT CONNECTED");
    setText("[data-sec-provider-status]", snapshot.secConnected ? "CONNECTED" : "PROVIDER NOT CONNECTED");
    setText("[data-universe-count]", snapshot.universeSize);
    setText("[data-examined-count]", snapshot.examined);
    setText("[data-sec-complete-count]", snapshot.complete);
    setText("[data-unresolved-count]", snapshot.unresolved);
    setText("[data-quote-count]", snapshot.quotes);
    setText("[data-rating-count]", snapshot.ratings);

    setText("[data-database-detail]", snapshot.databaseConnected
      ? `PostgreSQL is configured. The API reports ${snapshot.universeSize} active companies.`
      : "Provider Not Connected. PostgreSQL is not confirmed as configured.");
    setText("[data-sec-detail]", snapshot.secConnected
      ? `${snapshot.complete} companies have Official SEC Evidence; ${snapshot.unresolved} have Unresolved SEC Identity.`
      : "Provider Not Connected. Official SEC Evidence cannot be confirmed.");
    setText("[data-queue-detail]", `${snapshot.queued} queued · ${snapshot.processing} processing · ${snapshot.failed} failed.`);
    setText("[data-public-detail]", `${snapshot.examined} examined · ${snapshot.complete} complete · ${snapshot.unresolved} unresolved.`);

    if (!snapshot.databaseConnected || !snapshot.secConnected || !snapshot.universeConnected) {
      setText("[data-production-headline]", "PROVIDER NOT CONNECTED");
      setText("[data-production-message]", "The API answered, but one or more required production services are not configured. Returned totals are displayed without upgrading their meaning.");
    } else if (snapshot.queued > 0 || snapshot.processing > 0) {
      setText("[data-production-headline]", "SEC PROCESSING IS ACTIVE");
      setText("[data-production-message]", `${snapshot.queued} companies are queued, ${snapshot.processing} are processing, and ${snapshot.complete} currently have Official SEC Evidence.`);
    } else {
      setText("[data-production-headline]", "CURRENT SEC PROCESSING TOTALS VERIFIED");
      setText("[data-production-message]", `${snapshot.complete} companies have Official SEC Evidence and ${snapshot.unresolved} have Unresolved SEC Identity. Licensed quotes and production Monster Ratings™ remain separate systems.`);
    }
  }

  async function loadProductionStatus() {
    if (requestInFlight) return;
    requestInFlight = true;
    setRefreshState(true, "REFRESHING…");
    const baseUrl = apiBaseUrl();
    try {
      if (!baseUrl) throw new Error("The public API address is not configured.");
      const [health, universe] = await Promise.all([
        requestJson(`${baseUrl}/api/health`),
        requestJson(`${baseUrl}/api/universe/status?limit=${PUBLIC_LIMIT}`),
      ]);
      renderProduction(normalizeSnapshot(health, universe));
    } catch (error) {
      renderUnavailable(error instanceof Error ? error.message : "The production API could not be reached.");
    } finally {
      requestInFlight = false;
      setRefreshState(false, "REFRESH STATUS");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelector("[data-status-refresh]")?.addEventListener("click", () => void loadProductionStatus());
    void loadProductionStatus();
    window.setInterval(() => void loadProductionStatus(), 60_000);
  });
})();
