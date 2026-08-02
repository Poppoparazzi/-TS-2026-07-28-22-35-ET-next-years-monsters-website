// TS: 2026-08-02 13:31 ET

(() => {
  "use strict";

  const PILOT = Object.freeze([
    { ticker: "NVDA", name: "NVIDIA", tier: "platinum", demoScore: 96 },
    { ticker: "MSFT", name: "Microsoft", tier: "platinum", demoScore: 93 },
    { ticker: "APP", name: "AppLovin", tier: "platinum", demoScore: 92 },
    { ticker: "VRT", name: "Vertiv", tier: "platinum", demoScore: 91 },
    { ticker: "AMZN", name: "Amazon", tier: "platinum", demoScore: 90 },
    { ticker: "AXON", name: "Axon Enterprise", tier: "platinum", demoScore: 90 },
    { ticker: "META", name: "Meta Platforms", tier: "gold", demoScore: 89 },
    { ticker: "AAPL", name: "Apple", tier: "gold", demoScore: 88 },
    { ticker: "MNST", name: "Monster Beverage", tier: "gold", demoScore: 86 },
    { ticker: "COST", name: "Costco", tier: "gold", demoScore: 84 },
    { ticker: "NFLX", name: "Netflix", tier: "gold", demoScore: 84 },
    { ticker: "DECK", name: "Deckers Outdoor", tier: "gold", demoScore: 82 },
    { ticker: "AMD", name: "Advanced Micro Devices", tier: "gold", demoScore: 79 },
    { ticker: "WING", name: "Wingstop", tier: "gold", demoScore: 78 },
    { ticker: "TSLA", name: "Tesla", tier: "silver", demoScore: 72 },
  ]);

  const tableBody = document.querySelector("[data-verification-body]");
  const runButton = document.querySelector("[data-run-verification]");
  const timestampNode = document.querySelector("[data-verification-timestamp]");
  const secCountNode = document.querySelector("[data-sec-count]");
  const storedCountNode = document.querySelector("[data-stored-count]");
  const quoteCountNode = document.querySelector("[data-quote-count]");
  const ratingCountNode = document.querySelector("[data-rating-count]");

  function safe(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getApiBaseUrl() {
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

  const apiBaseUrl = getApiBaseUrl();

  function badge(label, state, detail = "") {
    return `<span class="verification-badge ${safe(state)}">${safe(label)}</span>${detail ? `<small class="verification-detail">${safe(detail)}</small>` : ""}`;
  }

  function formatTime(value) {
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

  function latestTimestamp(snapshot) {
    const values = [
      snapshot?.updatedAt,
      snapshot?.latestQuote?.retrievedAt,
      snapshot?.latestQuote?.providerTimestamp,
      snapshot?.latestFiling?.acceptedAt,
      snapshot?.latestFiling?.filingDate,
    ]
      .map((value) => new Date(value || 0))
      .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() > 0)
      .sort((a, b) => b.getTime() - a.getTime());

    return values[0]?.toISOString() || null;
  }

  async function request(path) {
    if (!apiBaseUrl) {
      return Object.freeze({ ok: false, status: 0, data: null, message: "Public API address is not configured." });
    }

    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(65_000),
      });
      const data = await response.json().catch(() => null);
      return Object.freeze({
        ok: response.ok,
        status: response.status,
        data,
        message: data?.message || data?.error || `HTTP ${response.status}`,
      });
    } catch (error) {
      return Object.freeze({
        ok: false,
        status: 0,
        data: null,
        message: error instanceof Error ? error.message : "Request failed.",
      });
    }
  }

  function seedRows() {
    if (!tableBody) return;

    tableBody.innerHTML = PILOT.map((stock) => `
      <tr data-verification-row="${safe(stock.ticker)}" data-tier="${safe(stock.tier)}">
        <td><span class="verification-symbol">${safe(stock.ticker)}</span><span class="verification-company">${safe(stock.name)}</span></td>
        <td data-sec>${badge("Waiting", "pending", "Official SEC identity has not been checked in this session.")}</td>
        <td data-filing>${badge("Waiting", "pending", "Stored filing evidence has not been checked.")}</td>
        <td data-quote>${badge("Waiting", "pending", "Stored quote evidence has not been checked.")}</td>
        <td data-rating>${badge("Demo only", "demo", `${stock.demoScore} historical demonstration score`)}</td>
        <td data-checked>Not checked</td>
        <td class="verification-gap" data-gap>Run verification to inspect the current backend record.</td>
      </tr>`).join("");
  }

  function updateSummary(summary) {
    if (secCountNode) secCountNode.textContent = String(summary.secVerified);
    if (storedCountNode) storedCountNode.textContent = String(summary.storedRecords);
    if (quoteCountNode) quoteCountNode.textContent = String(summary.quotesStored);
    if (ratingCountNode) ratingCountNode.textContent = String(summary.ratingsStored);
  }

  function updateRow(stock, companyResult, storedResult, summary) {
    const row = tableBody?.querySelector(`[data-verification-row="${stock.ticker}"]`);
    if (!row) return;

    const secCell = row.querySelector("[data-sec]");
    const filingCell = row.querySelector("[data-filing]");
    const quoteCell = row.querySelector("[data-quote]");
    const ratingCell = row.querySelector("[data-rating]");
    const checkedCell = row.querySelector("[data-checked]");
    const gapCell = row.querySelector("[data-gap]");

    const gaps = [];

    if (companyResult.ok) {
      summary.secVerified += 1;
      const company = companyResult.data;
      secCell.innerHTML = badge(
        "SEC verified",
        "verified",
        `${company.companyName || stock.name} · CIK ${company.cikPadded || company.cik || "available"}`,
      );
    } else {
      secCell.innerHTML = badge(
        companyResult.status === 404 ? "Not found" : "Unavailable",
        companyResult.status === 404 ? "missing" : "error",
        companyResult.message,
      );
      gaps.push("official SEC identity");
    }

    if (storedResult.ok) {
      summary.storedRecords += 1;
      const snapshot = storedResult.data;
      const filingCount = Number(snapshot.filingCount || 0);
      const factCount = Number(snapshot.factCount || 0);
      const ratingCount = Number(snapshot.ratingCount || 0);

      if (snapshot.latestFiling || filingCount > 0) {
        filingCell.innerHTML = badge(
          "Stored",
          "verified",
          `${snapshot.latestFiling?.form || filingCount + " filing(s)"} · ${factCount} company fact(s)`,
        );
      } else {
        filingCell.innerHTML = badge("Missing", "missing", "No filing or company-fact evidence is stored.");
        gaps.push("stored SEC filing/facts");
      }

      if (snapshot.latestQuote) {
        summary.quotesStored += 1;
        quoteCell.innerHTML = badge(
          "Stored quote",
          "verified",
          `${snapshot.latestQuote.provider || "provider"} · ${snapshot.latestQuote.freshness || "freshness not labeled"}`,
        );
      } else {
        quoteCell.innerHTML = badge("Not connected", "missing", "No quote snapshot is stored.");
        gaps.push("licensed quote snapshot");
      }

      if (ratingCount > 0) {
        summary.ratingsStored += 1;
        ratingCell.innerHTML = badge("Rating history", "verified", `${ratingCount} stored rating record(s)`);
      } else {
        ratingCell.innerHTML = badge("Demo only", "demo", `${stock.demoScore} historical demonstration score; no verified rating record`);
        gaps.push("verified production rating");
      }

      checkedCell.textContent = formatTime(latestTimestamp(snapshot));
    } else {
      const databaseUnavailable = storedResult.status === 503 || storedResult.status === 0;
      const state = databaseUnavailable ? "error" : "pending";
      const label = databaseUnavailable ? "Database unavailable" : "Not refreshed";
      const detail = storedResult.status === 404
        ? "No persistent pilot snapshot exists yet."
        : storedResult.message;

      filingCell.innerHTML = badge(label, state, detail);
      quoteCell.innerHTML = badge(label, state, detail);
      ratingCell.innerHTML = badge("Demo only", "demo", `${stock.demoScore} historical demonstration score; no stored production rating confirmed`);
      checkedCell.textContent = "No stored timestamp";
      gaps.push(databaseUnavailable ? "production database connection" : "pilot refresh snapshot");
      gaps.push("verified production rating");
    }

    gapCell.textContent = gaps.length
      ? `Still needed: ${[...new Set(gaps)].join(", ")}.`
      : "No evidence gap detected in the fields checked by this ledger.";
  }

  async function verifyStock(stock, summary) {
    const [companyResult, storedResult] = await Promise.all([
      request(`/api/sec/company/${encodeURIComponent(stock.ticker)}`),
      request(`/api/stored/${encodeURIComponent(stock.ticker)}`),
    ]);
    updateRow(stock, companyResult, storedResult, summary);
  }

  async function runVerification() {
    if (!runButton) return;

    runButton.disabled = true;
    runButton.textContent = "VERIFYING 15 STOCKS…";
    const summary = { secVerified: 0, storedRecords: 0, quotesStored: 0, ratingsStored: 0 };
    updateSummary(summary);

    const queue = [...PILOT];
    const workers = Array.from({ length: 3 }, async () => {
      while (queue.length) {
        const stock = queue.shift();
        if (!stock) return;
        await verifyStock(stock, summary);
        updateSummary(summary);
      }
    });

    await Promise.all(workers);

    const completedAt = new Date();
    if (timestampNode) timestampNode.textContent = `LAST CHECKED ${formatTime(completedAt.toISOString()).toUpperCase()}`;
    runButton.disabled = false;
    runButton.textContent = "RUN VERIFICATION AGAIN";
  }

  seedRows();
  updateSummary({ secVerified: 0, storedRecords: 0, quotesStored: 0, ratingsStored: 0 });
  runButton?.addEventListener("click", () => void runVerification());

  if (apiBaseUrl) {
    void runVerification();
  } else if (timestampNode) {
    timestampNode.textContent = "PUBLIC API ADDRESS NOT CONFIGURED";
  }
})();
