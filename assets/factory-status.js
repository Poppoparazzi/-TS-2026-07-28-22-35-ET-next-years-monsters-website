// TS: 2026-08-04 18:23 ET

(() => {
  "use strict";

  const FACTORY_LIMIT = 2000;
  const SUMMARY_SELECTORS = Object.freeze([
    "[data-factory-universe]",
    "[data-factory-examined]",
    "[data-factory-queued]",
    "[data-factory-processing]",
    "[data-factory-complete]",
    "[data-factory-partial]",
    "[data-factory-unresolved]",
    "[data-factory-failed]",
    "[data-factory-stale]",
    "[data-factory-filings]",
    "[data-factory-facts]",
    "[data-factory-quotes]",
    "[data-factory-ratings]",
  ]);
  const REQUIRED_COUNT_FIELDS = Object.freeze([
    "universeSize",
    "examinedCount",
    "queuedCount",
    "processingCount",
    "secCompleteCount",
    "partialCount",
    "unresolvedCount",
    "failedCount",
    "staleCount",
    "filingCompleteCount",
    "factsCompleteCount",
    "quoteCompleteCount",
    "ratingCompleteCount",
  ]);

  const refreshButton = document.querySelector("[data-factory-refresh]");
  const checkedNode = document.querySelector("[data-factory-checked]");
  const tableBody = document.querySelector("[data-factory-body]");
  const progressBar = document.querySelector("[data-factory-progress-bar]");
  const progressText = document.querySelector("[data-factory-progress-text]");
  let hasRenderedData = false;
  let requestInFlight = false;

  class PublicStatusError extends Error {}

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

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setText(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = String(value);
  }

  function formatTimestamp(value) {
    if (!value) return "Not recorded";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not recorded";

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  }

  function statusPill(status) {
    const normalized = [
      "queued",
      "processing",
      "complete",
      "partial",
      "failed",
      "stale",
      "unresolved",
    ].includes(status)
      ? status
      : "queued";
    const label = normalized === "processing" ? "in batch" : normalized;
    return `<span class="factory-pill ${normalized}">${escapeHtml(label)}</span>`;
  }

  function evidenceCheck(label, ready) {
    return `<span class="factory-check ${ready ? "yes" : "no"}">${escapeHtml(label)}</span>`;
  }

  function renderSummary(payload) {
    setText("[data-factory-universe]", payload.universeSize);
    setText("[data-factory-examined]", payload.examinedCount);
    setText("[data-factory-queued]", payload.queuedCount);
    setText("[data-factory-processing]", payload.processingCount);
    setText("[data-factory-complete]", payload.secCompleteCount);
    setText("[data-factory-partial]", payload.partialCount);
    setText("[data-factory-unresolved]", payload.unresolvedCount);
    setText("[data-factory-failed]", payload.failedCount);
    setText("[data-factory-stale]", payload.staleCount);
    setText("[data-factory-filings]", payload.filingCompleteCount);
    setText("[data-factory-facts]", payload.factsCompleteCount);
    setText("[data-factory-quotes]", payload.quoteCompleteCount);
    setText("[data-factory-ratings]", payload.ratingCompleteCount);

    const examined = payload.examinedCount;
    const complete = payload.secCompleteCount;
    const percent = examined > 0 ? Math.min(Math.max((complete / examined) * 100, 0), 100) : 0;

    if (progressBar) progressBar.style.width = `${percent.toFixed(1)}%`;
    if (progressText) {
      progressText.textContent = `${complete} of ${examined} examined companies have complete SEC evidence · ${percent.toFixed(1)}%`;
    }
  }

  function renderRows(companies) {
    if (!tableBody) return;

    if (companies.length === 0) {
      tableBody.innerHTML = "<tr><td colspan=\"12\"><p class=\"factory-empty\">The production database returned no imported companies. The first universe import has not completed.</p></td></tr>";
      return;
    }

    tableBody.innerHTML = companies.map((company) => `
      <tr>
        <td class="factory-company"><strong>$${escapeHtml(company.ticker)}</strong><span>${escapeHtml(company.companyName)}</span></td>
        <td>${statusPill(company.secStage)}</td>
        <td><strong>${escapeHtml(company.secAttemptCount ?? 0)}</strong></td>
        <td>${evidenceCheck("Identity", Boolean(company.hasSecIdentity))}</td>
        <td>${evidenceCheck("Filings", Boolean(company.hasFilings))}</td>
        <td>${evidenceCheck("Facts", Boolean(company.hasFacts))}</td>
        <td>${evidenceCheck("Quote", Boolean(company.hasQuote))}</td>
        <td>${evidenceCheck("Rating", Boolean(company.hasRating))}</td>
        <td><span class="factory-small">${escapeHtml(formatTimestamp(company.lastStartedAt))}</span></td>
        <td><span class="factory-small">${escapeHtml(formatTimestamp(company.lastCompletedAt))}</span></td>
        <td><span class="factory-small">${escapeHtml(formatTimestamp(company.nextRetryAt))}</span></td>
        <td><span class="factory-error">${escapeHtml(company.lastError || "None")}</span></td>
      </tr>`).join("");
  }

  function renderUnavailableSummary() {
    SUMMARY_SELECTORS.forEach((selector) => setText(selector, "—"));
    if (progressBar) progressBar.style.width = "0%";
    if (progressText) {
      progressText.textContent = "PROVIDER NOT CONNECTED · No factory totals are being displayed.";
    }
  }

  function renderUnavailable(message) {
    if (!hasRenderedData) {
      renderUnavailableSummary();
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="12"><p class="factory-empty"><strong>Provider Not Connected.</strong> ${escapeHtml(message)} No completion values are being claimed.</p></td></tr>`;
      }
    }

    if (checkedNode) {
      checkedNode.textContent = `PROVIDER NOT CONNECTED · LAST ATTEMPT ${formatTimestamp(new Date().toISOString()).toUpperCase()}`;
    }
  }

  async function requestJson(url) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(65_000),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new PublicStatusError(
        response.status === 503
          ? "The production data provider is not connected."
          : "The production data provider could not complete the request.",
      );
    }
    return payload;
  }

  function verifyProductionHealth(health) {
    if (!health || typeof health !== "object" || health.status !== "ok") {
      throw new PublicStatusError("The production health check returned an invalid response.");
    }

    const missing = [];
    if (!health.database?.configured) missing.push("production database");
    if (!health.sec?.configured) missing.push("official SEC evidence");
    if (!health.universe?.configured) missing.push("2,000-company universe");

    if (missing.length > 0) {
      throw new PublicStatusError(`Required services are not connected: ${missing.join(", ")}.`);
    }
  }

  function validateFactoryPayload(payload) {
    if (!payload || typeof payload !== "object" || payload.configured !== true) {
      throw new PublicStatusError("The factory endpoint returned an invalid production status.");
    }
    if (!Array.isArray(payload.companies)) {
      throw new PublicStatusError("The factory endpoint did not return a company status list.");
    }

    for (const field of REQUIRED_COUNT_FIELDS) {
      if (!Number.isInteger(payload[field]) || payload[field] < 0) {
        throw new PublicStatusError("The factory endpoint returned incomplete count data.");
      }
    }

    if (payload.examinedCount !== payload.companies.length) {
      throw new PublicStatusError("The factory endpoint returned totals that do not reconcile with its company list.");
    }

    const statusTotal =
      payload.queuedCount +
      payload.processingCount +
      payload.secCompleteCount +
      payload.partialCount +
      payload.unresolvedCount +
      payload.failedCount +
      payload.staleCount;
    if (statusTotal !== payload.examinedCount) {
      throw new PublicStatusError("The factory endpoint returned pipeline totals that do not reconcile.");
    }

    return payload;
  }

  async function loadFactoryStatus() {
    if (requestInFlight) return;

    const baseUrl = apiBaseUrl();
    if (!baseUrl) {
      renderUnavailable("The public API address is not configured.");
      return;
    }

    requestInFlight = true;
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.textContent = "CHECKING FACTORY…";
    }

    try {
      const health = await requestJson(`${baseUrl}/api/health`);
      verifyProductionHealth(health);

      const rawPayload = await requestJson(`${baseUrl}/api/universe/status?limit=${FACTORY_LIMIT}`);
      const payload = validateFactoryPayload(rawPayload);
      renderSummary(payload);
      renderRows(payload.companies);
      hasRenderedData = true;
      if (checkedNode) {
        const version = typeof health.version === "string" && health.version ? health.version : "connected";
        checkedNode.textContent = `BACKEND ${version} · LAST CHECKED ${formatTimestamp(payload.generatedAt || new Date().toISOString()).toUpperCase()}`;
      }
    } catch (error) {
      const message = error instanceof PublicStatusError
        ? error.message
        : "The production data provider could not be reached or returned an invalid response.";
      renderUnavailable(message);
    } finally {
      requestInFlight = false;
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.textContent = "REFRESH FACTORY STATUS";
      }
    }
  }

  refreshButton?.addEventListener("click", () => void loadFactoryStatus());
  document.addEventListener("DOMContentLoaded", () => {
    void loadFactoryStatus();
    window.setInterval(() => void loadFactoryStatus(), 60_000);
  });
})();
