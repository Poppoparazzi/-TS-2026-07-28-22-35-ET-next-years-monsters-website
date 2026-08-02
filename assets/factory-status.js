// TS: 2026-08-02 15:25 ET

(() => {
  "use strict";

  const refreshButton = document.querySelector("[data-factory-refresh]");
  const checkedNode = document.querySelector("[data-factory-checked]");
  const tableBody = document.querySelector("[data-factory-body]");
  const progressBar = document.querySelector("[data-factory-progress-bar]");
  const progressText = document.querySelector("[data-factory-progress-text]");

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
    const normalized = ["queued", "processing", "complete", "partial", "failed", "stale"]
      .includes(status)
      ? status
      : "queued";
    return `<span class="factory-pill ${normalized}">${escapeHtml(normalized)}</span>`;
  }

  function evidenceCheck(label, ready) {
    return `<span class="factory-check ${ready ? "yes" : "no"}">${escapeHtml(label)}</span>`;
  }

  function renderSummary(payload) {
    setText("[data-factory-universe]", payload.universeSize ?? 0);
    setText("[data-factory-examined]", payload.examinedCount ?? 0);
    setText("[data-factory-queued]", payload.queuedCount ?? 0);
    setText("[data-factory-processing]", payload.processingCount ?? 0);
    setText("[data-factory-complete]", payload.secCompleteCount ?? 0);
    setText("[data-factory-partial]", payload.partialCount ?? 0);
    setText("[data-factory-failed]", payload.failedCount ?? 0);
    setText("[data-factory-stale]", payload.staleCount ?? 0);
    setText("[data-factory-filings]", payload.filingCompleteCount ?? 0);
    setText("[data-factory-facts]", payload.factsCompleteCount ?? 0);
    setText("[data-factory-quotes]", payload.quoteCompleteCount ?? 0);
    setText("[data-factory-ratings]", payload.ratingCompleteCount ?? 0);

    const examined = Number(payload.examinedCount ?? 0);
    const complete = Number(payload.secCompleteCount ?? 0);
    const percent = examined > 0 ? Math.min(Math.max((complete / examined) * 100, 0), 100) : 0;

    if (progressBar) progressBar.style.width = `${percent.toFixed(1)}%`;
    if (progressText) {
      progressText.textContent = `${complete} of ${examined} examined companies have complete SEC evidence · ${percent.toFixed(1)}%`;
    }
  }

  function renderRows(companies) {
    if (!tableBody) return;

    if (!Array.isArray(companies) || companies.length === 0) {
      tableBody.innerHTML = "<tr><td colspan=\"12\"><p class=\"factory-empty\">No imported companies were returned. The production database may not have completed its first universe import.</p></td></tr>";
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

  function renderUnavailable(message) {
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="12"><p class="factory-empty">${escapeHtml(message)} No completion values were invented.</p></td></tr>`;
    }
    if (checkedNode) checkedNode.textContent = "FACTORY STATUS UNAVAILABLE";
  }

  async function loadFactoryStatus() {
    const baseUrl = apiBaseUrl();
    if (!baseUrl) {
      renderUnavailable("The public API address is not configured.");
      return;
    }

    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.textContent = "CHECKING FACTORY…";
    }

    try {
      const response = await fetch(`${baseUrl}/api/universe/status?limit=100`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(65_000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || `Factory endpoint returned HTTP ${response.status}.`);
      }

      renderSummary(payload);
      renderRows(payload.companies);
      if (checkedNode) {
        checkedNode.textContent = `LAST CHECKED ${formatTimestamp(payload.generatedAt || new Date().toISOString()).toUpperCase()}`;
      }
    } catch (error) {
      renderUnavailable(error instanceof Error ? error.message : "The factory endpoint could not be reached.");
    } finally {
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
