// TS: 2026-08-04 07:49 ET

(() => {
  "use strict";

  const config = window.NYM_CONFIG ?? {};
  const PUBLIC_LIMIT = 2000;

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

  async function requestJson(url) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(65_000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.message || `${url} returned HTTP ${response.status}.`);
    }
    return payload;
  }

  function renderUnavailable(message) {
    setText("[data-api-version]", "UNAVAILABLE");
    setText("[data-database-status]", "UNKNOWN");
    setText("[data-sec-provider-status]", "UNKNOWN");
    setText("[data-production-headline]", "LIVE PRODUCTION STATUS UNAVAILABLE");
    setText(
      "[data-production-message]",
      `${message} The page is preserving zero or unknown values instead of inventing progress.`,
    );
    setText("[data-database-detail]", "The production API could not confirm PostgreSQL status.");
    setText("[data-sec-detail]", "The production API could not confirm SEC provider status.");
    setText("[data-queue-detail]", "Queue and processing counts could not be verified.");
    setText("[data-public-detail]", "Public completion counts could not be verified.");
  }

  function renderProduction(health, universe) {
    const databaseConnected = Boolean(health?.database?.configured);
    const secConnected = Boolean(health?.sec?.configured);
    const universeConnected = Boolean(health?.universe?.configured);

    const universeSize = Number(universe?.universeSize ?? 0);
    const examined = Number(universe?.examinedCount ?? 0);
    const complete = Number(universe?.secCompleteCount ?? 0);
    const unresolved = Number(universe?.unresolvedCount ?? 0);
    const queued = Number(universe?.queuedCount ?? 0);
    const processing = Number(universe?.processingCount ?? 0);
    const failed = Number(universe?.failedCount ?? 0);
    const quotes = Number(universe?.quoteCompleteCount ?? 0);
    const ratings = Number(universe?.ratingCompleteCount ?? 0);

    setText("[data-api-version]", health?.version || "UNKNOWN");
    setText("[data-database-status]", databaseConnected ? "CONNECTED" : "NOT CONNECTED");
    setText("[data-sec-provider-status]", secConnected ? "CONNECTED" : "NOT CONNECTED");
    setText("[data-universe-count]", universeSize);
    setText("[data-examined-count]", examined);
    setText("[data-sec-complete-count]", complete);
    setText("[data-unresolved-count]", unresolved);
    setText("[data-quote-count]", quotes);
    setText("[data-rating-count]", ratings);

    setText(
      "[data-database-detail]",
      databaseConnected
        ? `PostgreSQL is configured. The active universe currently reports ${universeSize} companies.`
        : "PostgreSQL is not confirmed as configured.",
    );
    setText(
      "[data-sec-detail]",
      secConnected
        ? `${complete} public companies have complete SEC evidence and ${unresolved} remain unresolved.`
        : "The SEC provider is not confirmed as configured.",
    );
    setText(
      "[data-queue-detail]",
      `${queued} queued · ${processing} processing · ${failed} failed.`,
    );
    setText(
      "[data-public-detail]",
      `${examined} examined · ${complete} complete · ${unresolved} unresolved · target ${PUBLIC_LIMIT} complete.`,
    );

    if (!databaseConnected || !secConnected || !universeConnected) {
      setText("[data-production-headline]", "ONE OR MORE PRODUCTION SERVICES ARE NOT CONNECTED");
      setText(
        "[data-production-message]",
        "The backend answered, but database, SEC, or universe configuration is incomplete. The page is showing the returned counts without upgrading their meaning.",
      );
      return;
    }

    if (queued > 0 || processing > 0) {
      setText("[data-production-headline]", "THE SEC FACTORY IS ACTIVELY PROCESSING");
      setText(
        "[data-production-message]",
        `${queued} companies are queued and ${processing} are processing. ${complete} are already SEC complete.`,
      );
      return;
    }

    if (complete >= PUBLIC_LIMIT && unresolved === 0 && failed === 0) {
      setText("[data-production-headline]", "THE PUBLIC 2,000 IS SEC COMPLETE");
      setText(
        "[data-production-message]",
        `All ${PUBLIC_LIMIT} public companies have complete SEC evidence. Licensed quotes and production Monster Ratings™ remain separate unfinished systems.`,
      );
      return;
    }

    setText("[data-production-headline]", "THE CURRENT SEC RUN IS TERMINAL, BUT THE PUBLIC 2,000 IS NOT COMPLETE");
    setText(
      "[data-production-message]",
      `${complete} companies are SEC complete and ${unresolved} are unresolved, with ${queued} queued and ${processing} processing. The reserve-pool deployment must supply additional completed companies before the public list reaches ${PUBLIC_LIMIT} complete.`,
    );
  }

  async function loadProductionStatus() {
    const baseUrl = apiBaseUrl();
    if (!baseUrl) {
      renderUnavailable("The public API address is not configured.");
      return;
    }

    try {
      const [health, universe] = await Promise.all([
        requestJson(`${baseUrl}/api/health`),
        requestJson(`${baseUrl}/api/universe/status?limit=${PUBLIC_LIMIT}`),
      ]);
      renderProduction(health, universe);
    } catch (error) {
      renderUnavailable(error instanceof Error ? error.message : "The production API could not be reached.");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    void loadProductionStatus();
    window.setInterval(() => void loadProductionStatus(), 60_000);
  });
})();
