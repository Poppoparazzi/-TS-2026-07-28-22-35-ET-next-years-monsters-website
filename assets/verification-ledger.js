// TS: 2026-08-04 22:18 ET

(() => {
  "use strict";

  const PILOT = Object.freeze([
    { ticker: "NVDA", name: "NVIDIA", tier: "platinum", demoScore: 94 },
    { ticker: "MSFT", name: "Microsoft", tier: "gold", demoScore: 89 },
    { ticker: "APP", name: "AppLovin", tier: "platinum", demoScore: 94 },
    { ticker: "VRT", name: "Vertiv", tier: "platinum", demoScore: 92 },
    { ticker: "AMZN", name: "Amazon", tier: "platinum", demoScore: 91 },
    { ticker: "AXON", name: "Axon Enterprise", tier: "platinum", demoScore: 92 },
    { ticker: "META", name: "Meta Platforms", tier: "gold", demoScore: 88 },
    { ticker: "AAPL", name: "Apple", tier: "gold", demoScore: 88 },
    { ticker: "MNST", name: "Monster Beverage", tier: "platinum", demoScore: 92 },
    { ticker: "COST", name: "Costco", tier: "platinum", demoScore: 90 },
    { ticker: "NFLX", name: "Netflix", tier: "platinum", demoScore: 88 },
    { ticker: "DECK", name: "Deckers Outdoor", tier: "platinum", demoScore: 90 },
    { ticker: "AMD", name: "Advanced Micro Devices", tier: "gold", demoScore: 89 },
    { ticker: "WING", name: "Wingstop", tier: "platinum", demoScore: 91 },
    { ticker: "TSLA", name: "Tesla", tier: "platinum", demoScore: 90 },
  ]);

  const tableBody = document.querySelector("[data-verification-body]");
  const runButton = document.querySelector("[data-run-verification]");
  const timestampNode = document.querySelector("[data-verification-timestamp]");
  const secCountNode = document.querySelector("[data-sec-count]");
  const storedCountNode = document.querySelector("[data-stored-count]");
  const quoteCountNode = document.querySelector("[data-quote-count]");
  const ratingCountNode = document.querySelector("[data-rating-count]");
  let verificationInFlight = false;

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
      return Object.freeze({ ok: false, status: 0, data: null });
    }

    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(65_000),
      });
      const data = await response.json().catch(() => null);
      return Object.freeze({ ok: response.ok, status: response.status, data });
    } catch (_error) {
      return Object.freeze({ ok: false, status: 0, data: null });
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
        <td data-rating>${badge("Demonstration Rating", "demo", `${stock.demoScore} historical demonstration score; not a production Monster Rating™`)}</td>
        <td data-checked>Not checked</td>
        <td class="verification-gap" data-gap>Run verification to inspect the current backend record.</td>
      </tr>`).join("");
  }

  function setSummaryValues(values) {
    if (secCountNode) secCountNode.textContent = String(values.secVerified);
    if (storedCountNode) storedCountNode.textContent = String(values.storedRecords);
    if (quoteCountNode) quoteCountNode.textContent = String(values.quotesStored);
    if (ratingCountNode) ratingCountNode.textContent = String(values.ratingsStored);
  }

  function updateSummary(summary) {
    setSummaryValues(summary || {
      secVerified: "—",
      storedRecords: "—",
      quotesStored: "—",
      ratingsStored: "—",
    });
  }

  function providerNotConnected(detail) {
    updateSummary(null);

    for (const stock of PILOT) {
      const row = tableBody?.querySelector(`[data-verification-row="${stock.ticker}"]`);
      if (!row) continue;

      row.querySelector("[data-sec]").innerHTML = badge("Provider Not Connected", "error", detail);
      row.querySelector("[data-filing]").innerHTML = badge("Provider Not Connected", "error", detail);
      row.querySelector("[data-quote]").innerHTML = badge("Provider Not Connected", "error", "No stored quote status can be confirmed.");
      row.querySelector("[data-rating]").innerHTML = badge(
        "Demonstration Rating",
        "demo",
        `${stock.demoScore} historical demonstration score; not a production Monster Rating™`,
      );
      row.querySelector("[data-checked]").textContent = "Not checked";
      row.querySelector("[data-gap]").textContent = "Still needed: production provider connection and verified production rating.";
    }

    if (timestampNode) {
      timestampNode.textContent = `PROVIDER NOT CONNECTED · LAST ATTEMPT ${formatTime(new Date().toISOString()).toUpperCase()}`;
    }
  }

  function healthIssue(healthResult) {
    if (!healthResult.ok || !healthResult.data || healthResult.data.status !== "ok") {
      return "The production data service could not be reached.";
    }

    const missing = [];
    if (!healthResult.data.sec?.configured) missing.push("official SEC evidence");
    if (!healthResult.data.database?.configured) missing.push("production database");
    return missing.length > 0
      ? `Required services are not connected: ${missing.join(", ")}.`
      : null;
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

    if (companyResult.ok && companyResult.data) {
      summary.secVerified += 1;
      const company = companyResult.data;
      secCell.innerHTML = badge(
        "Official SEC Evidence",
        "verified",
        `${company.companyName || stock.name} · CIK ${company.cikPadded || company.cik || "available"}`,
      );
    } else if (companyResult.status === 404) {
      secCell.innerHTML = badge("Unresolved SEC Identity", "missing", "No official SEC ticker mapping was returned.");
      gaps.push("official SEC identity");
    } else {
      secCell.innerHTML = badge("Provider Not Connected", "error", "Official SEC evidence could not be checked.");
      gaps.push("official SEC evidence provider");
    }

    if (storedResult.ok && storedResult.data) {
      summary.storedRecords += 1;
      const snapshot = storedResult.data;
      const filingCount = Number(snapshot.filingCount || 0);
      const factCount = Number(snapshot.factCount || 0);
      const ratingCount = Number(snapshot.ratingCount || 0);

      if (snapshot.latestFiling || filingCount > 0) {
        filingCell.innerHTML = badge(
          "Official SEC Evidence",
          "verified",
          `${snapshot.latestFiling?.form || filingCount + " filing(s)"} · ${factCount} company fact(s)`,
        );
      } else {
        filingCell.innerHTML = badge("Not Yet Stored", "missing", "No filing or company-fact evidence is stored.");
        gaps.push("stored SEC filing/facts");
      }

      if (snapshot.latestQuote) {
        summary.quotesStored += 1;
        quoteCell.innerHTML = badge(
          "Stored External Market Data",
          "verified",
          `${snapshot.latestQuote.provider || "provider"} · ${snapshot.latestQuote.freshness || "freshness not labeled"}`,
        );
      } else {
        quoteCell.innerHTML = badge("Not Yet Connected", "missing", "No licensed quote snapshot is stored.");
        gaps.push("licensed quote snapshot");
      }

      if (ratingCount > 0) {
        summary.ratingsStored += 1;
        ratingCell.innerHTML = badge("Stored Rating History", "verified", `${ratingCount} verified database record(s)`);
      } else {
        ratingCell.innerHTML = badge(
          "Demonstration Rating",
          "demo",
          `${stock.demoScore} historical demonstration score; not a production Monster Rating™`,
        );
        gaps.push("verified production rating");
      }

      checkedCell.textContent = formatTime(latestTimestamp(snapshot));
    } else if (storedResult.status === 404) {
      filingCell.innerHTML = badge("Not Yet Stored", "pending", "No persistent pilot snapshot exists yet.");
      quoteCell.innerHTML = badge("Not Yet Connected", "pending", "No licensed quote snapshot is stored.");
      ratingCell.innerHTML = badge(
        "Demonstration Rating",
        "demo",
        `${stock.demoScore} historical demonstration score; not a production Monster Rating™`,
      );
      checkedCell.textContent = "No stored timestamp";
      gaps.push("pilot refresh snapshot", "verified production rating");
    } else {
      filingCell.innerHTML = badge("Provider Not Connected", "error", "Stored evidence could not be checked.");
      quoteCell.innerHTML = badge("Provider Not Connected", "error", "Stored quote status could not be checked.");
      ratingCell.innerHTML = badge(
        "Demonstration Rating",
        "demo",
        `${stock.demoScore} historical demonstration score; no production rating was confirmed`,
      );
      checkedCell.textContent = "Not checked";
      gaps.push("production database connection", "verified production rating");
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
    if (!runButton || verificationInFlight) return;

    verificationInFlight = true;
    runButton.disabled = true;
    runButton.textContent = "VERIFYING 15 STOCKS…";
    setSummaryValues({
      secVerified: "…",
      storedRecords: "…",
      quotesStored: "…",
      ratingsStored: "…",
    });

    try {
      const healthResult = await request("/api/health");
      const issue = healthIssue(healthResult);
      if (issue) {
        providerNotConnected(issue);
        return;
      }

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
      if (timestampNode) {
        timestampNode.textContent = `LAST CHECKED ${formatTime(new Date().toISOString()).toUpperCase()}`;
      }
    } finally {
      verificationInFlight = false;
      runButton.disabled = false;
      runButton.textContent = "RUN VERIFICATION AGAIN";
    }
  }

  seedRows();
  updateSummary({ secVerified: 0, storedRecords: 0, quotesStored: 0, ratingsStored: 0 });
  runButton?.addEventListener("click", () => void runVerification());

  if (apiBaseUrl) {
    void runVerification();
  } else {
    providerNotConnected("The public API address is not configured.");
  }
})();
