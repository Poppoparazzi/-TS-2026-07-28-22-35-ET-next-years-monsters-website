// TS: 2026-08-02 13:44 ET

(() => {
  "use strict";

  function apiBaseUrl() {
    const raw = window.NYM_CONFIG?.apiBaseUrl;
    if (typeof raw !== "string" || !raw.trim()) return null;

    try {
      const url = new URL(raw.trim());
      const localDevelopment = ["localhost", "127.0.0.1"].includes(url.hostname);
      if (url.protocol !== "https:" && !localDevelopment) return null;
      return url.href.replace(/\/$/, "");
    } catch (_error) {
      return null;
    }
  }

  function setText(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  }

  function setCard(cardSelector, state, provider, detail) {
    const card = document.querySelector(cardSelector);
    if (!card) return;

    card.dataset.connectionState = state;
    const providerNode = card.querySelector("[data-connection-provider]");
    const detailNode = card.querySelector("[data-connection-detail]");
    if (providerNode) providerNode.textContent = provider;
    if (detailNode) detailNode.textContent = detail;
  }

  function formatTimestamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Timestamp unavailable";

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  }

  function providerState(configured) {
    return configured ? "connected" : "not-configured";
  }

  function providerLabel(provider, configured) {
    return configured
      ? `${String(provider || "provider").toUpperCase()} · CONNECTED`
      : `${String(provider || "provider").toUpperCase()} · NOT CONFIGURED`;
  }

  function renderHealth(health) {
    setCard(
      "[data-api-connection-card]",
      "connected",
      `${String(health.service || "API").toUpperCase()} · ONLINE`,
      `Backend version ${health.version || "unknown"} answered the public health check.`,
    );

    const marketConfigured = Boolean(health.marketData?.configured);
    setCard(
      "[data-market-connection-card]",
      providerState(marketConfigured),
      providerLabel(health.marketData?.provider, marketConfigured),
      marketConfigured
        ? "The server reports a market-data provider is configured. Quote licensing and display rights still require verification."
        : "No market-data provider is enabled. The website must not present stored quotes as live production data.",
    );

    const secConfigured = Boolean(health.sec?.configured);
    setCard(
      "[data-sec-connection-card]",
      providerState(secConfigured),
      providerLabel(health.sec?.provider, secConfigured),
      secConfigured
        ? "The official SEC company and filing service is configured."
        : "The official SEC service is not configured on the production backend.",
    );

    const databaseConfigured = Boolean(health.database?.configured);
    setCard(
      "[data-database-connection-card]",
      providerState(databaseConfigured),
      providerLabel(health.database?.provider, databaseConfigured),
      databaseConfigured
        ? "The server reports a persistent database connection is configured. Stored pilot records still need to be inspected individually."
        : "The production database is not configured, so saved snapshots and rating history cannot be verified.",
    );

    setText(
      "[data-health-checked]",
      `PUBLIC HEALTH CHECK · ${formatTimestamp(health.timestamp || new Date().toISOString())}`,
    );
  }

  function renderUnavailable(message) {
    setCard("[data-api-connection-card]", "unavailable", "API · UNAVAILABLE", message);
    setCard("[data-market-connection-card]", "unavailable", "MARKET DATA · UNKNOWN", "Provider status could not be checked.");
    setCard("[data-sec-connection-card]", "unavailable", "SEC SERVICE · UNKNOWN", "Provider status could not be checked.");
    setCard("[data-database-connection-card]", "unavailable", "DATABASE · UNKNOWN", "Provider status could not be checked.");
    setText("[data-health-checked]", "PUBLIC HEALTH CHECK DID NOT COMPLETE");
  }

  async function checkHealth() {
    const baseUrl = apiBaseUrl();
    if (!baseUrl) {
      renderUnavailable("The public backend address is not configured in the website runtime settings.");
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(65_000),
      });
      if (!response.ok) throw new Error(`Health endpoint returned HTTP ${response.status}.`);
      renderHealth(await response.json());
    } catch (error) {
      renderUnavailable(error instanceof Error ? error.message : "The public health endpoint could not be reached.");
    }
  }

  document.addEventListener("DOMContentLoaded", () => void checkHealth());
})();
