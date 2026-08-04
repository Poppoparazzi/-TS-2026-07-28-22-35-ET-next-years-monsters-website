// TS: 2026-08-04 20:08 ET

(() => {
  "use strict";

  const CASES = Object.freeze([
    { ticker: "NVDA", name: "NVIDIA", demo: "94 / 100" },
    { ticker: "AAPL", name: "Apple", demo: "88 / 100" },
    { ticker: "MNST", name: "Monster Beverage", demo: "92 / 100" },
    { ticker: "AMZN", name: "Amazon", demo: "91 / 100" },
    { ticker: "TSLA", name: "Tesla", demo: "90 / 100" },
    { ticker: "NFLX", name: "Netflix", demo: "88 / 100 · printed Platinum case rating" },
    { ticker: "AMD", name: "Advanced Micro Devices", demo: "89 / 100" },
    { ticker: "COST", name: "Costco", demo: "No numeric score printed · High-quality compounder case" },
    { ticker: "MSFT", name: "Microsoft", demo: "89 / 100" },
    { ticker: "META", name: "Meta Platforms", demo: "88 / 100" },
    { ticker: "APP", name: "AppLovin", demo: "94 / 100" },
    { ticker: "VRT", name: "Vertiv", demo: "92 / 100" },
    { ticker: "AXON", name: "Axon Enterprise", demo: "92 / 100" },
    { ticker: "DECK", name: "Deckers Outdoor", demo: "90 / 100" },
    { ticker: "WING", name: "Wingstop", demo: "91 / 100" },
  ]);

  const tableBody = document.querySelector("[data-verification-body]");
  const runButton = document.querySelector("[data-run-verification]");
  const timestampNode = document.querySelector("[data-verification-timestamp]");
  const counters = {
    sec: document.querySelector("[data-sec-count]"),
    stored: document.querySelector("[data-stored-count]"),
    quote: document.querySelector("[data-quote-count]"),
    rating: document.querySelector("[data-rating-count]"),
  };
  let verificationInFlight = false;

  function safe(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function apiBase() {
    const raw = window.NYM_CONFIG?.apiBaseUrl;
    if (typeof raw !== "string" || !raw.trim()) return null;
    try {
      const url = new URL(raw.trim());
      const local = ["localhost", "127.0.0.1"].includes(url.hostname);
      return url.protocol === "https:" || local ? url.href.replace(/\/$/, "") : null;
    } catch (_error) {
      return null;
    }
  }

  const apiBaseUrl = apiBase();

  function badge(label, state, detail = "") {
    return `<span class="verification-badge ${safe(state)}">${safe(label)}</span>${detail ? `<small class="verification-detail">${safe(detail)}</small>` : ""}`;
  }

  function formatTime(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return "Not recorded";
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
    return [
      snapshot?.updatedAt,
      snapshot?.latestQuote?.retrievedAt,
      snapshot?.latestQuote?.providerTimestamp,
      snapshot?.latestFiling?.acceptedAt,
      snapshot?.latestFiling?.filingDate,
    ]
      .map((value) => new Date(value || 0))
      .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() > 0)
      .sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() || null;
  }

  async function request(path) {
    if (!apiBaseUrl) return { ok: false, status: 0, data: null };
    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(65_000),
      });
      return {
        ok: response.ok,
        status: response.status,
        data: await response.json().catch(() => null),
      };
    } catch (_error) {
      return { ok: false, status: 0, data: null };
    }
  }

  function setSummary({ sec = "—", stored = "—", quote = "—", rating = "—" } = {}) {
    if (counters.sec) counters.sec.textContent = String(sec);
    if (counters.stored) counters.stored.textContent = String(stored);
    if (counters.quote) counters.quote.textContent = String(quote);
    if (counters.rating) counters.rating.textContent = String(rating);
  }

  function demoBadge(stock, extra = "") {
    const detail = `${stock.demo}. Historical book example; not a production Monster Rating™${extra ? ` · ${extra}` : ""}`;
    return badge("Demonstration Rating", "demo", detail);
  }

  function seedRows() {
    if (!tableBody) return;
    tableBody.innerHTML = CASES.map((stock) => `
      <tr data-verification-row="${safe(stock.ticker)}">
        <td><span class="verification-symbol">${safe(stock.ticker)}</span><span class="verification-company">${safe(stock.name)}</span></td>
        <td data-sec>${badge("Waiting", "pending", "Official SEC Evidence has not been checked in this session.")}</td>
        <td data-filing>${badge("Waiting", "pending", "Stored SEC evidence has not been checked in this session.")}</td>
        <td data-quote>${badge("Waiting", "pending", "External market-data storage has not been checked in this session.")}</td>
        <td data-rating>${demoBadge(stock)}</td>
        <td data-checked>Not checked</td>
        <td class="verification-gap" data-gap>Run verification to inspect the connected services.</td>
      </tr>`).join("");
  }

  function setProviderFailure(detail) {
    setSummary();
    for (const stock of CASES) {
      const row = tableBody?.querySelector(`[data-verification-row="${stock.ticker}"]`);
      if (!row) continue;
      row.querySelector("[data-sec]").innerHTML = badge("Provider Not Connected", "error", detail);
      row.querySelector("[data-filing]").innerHTML = badge("Provider Not Connected", "error", detail);
      row.querySelector("[data-quote]").innerHTML = badge("Provider Not Connected", "error", "External market-data status could not be confirmed.");
      row.querySelector("[data-rating]").innerHTML = demoBadge(stock, "No production rating was confirmed");
      row.querySelector("[data-checked]").textContent = "Not checked";
      row.querySelector("[data-gap]").textContent = "Still needed: connected production services and a verified production rating.";
    }
    if (timestampNode) timestampNode.textContent = `PROVIDER NOT CONNECTED · LAST ATTEMPT ${formatTime(Date.now()).toUpperCase()}`;
  }

  function healthProblem(result) {
    if (!result.ok || !result.data || result.data.status !== "ok") return "The production data service could not be reached.";
    const missing = [];
    if (!result.data.sec?.configured) missing.push("Official SEC Evidence");
    if (!result.data.database?.configured) missing.push("production database");
    return missing.length ? `Required services are not connected: ${missing.join(", ")}.` : null;
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
      summary.sec += 1;
      secCell.innerHTML = badge("Official SEC Evidence", "verified", `${companyResult.data.companyName || stock.name} · CIK ${companyResult.data.cikPadded || companyResult.data.cik || "available"}`);
    } else if (companyResult.status === 404) {
      secCell.innerHTML = badge("Unresolved SEC Identity", "missing", "No official SEC ticker mapping was returned.");
      gaps.push("official SEC identity");
    } else {
      secCell.innerHTML = badge("Provider Not Connected", "error", "Official SEC Evidence could not be checked.");
      gaps.push("Official SEC Evidence provider");
    }

    if (storedResult.ok && storedResult.data) {
      summary.stored += 1;
      const snapshot = storedResult.data;
      const filingCount = Number(snapshot.filingCount || 0);
      const factCount = Number(snapshot.factCount || 0);
      const ratingCount = Number(snapshot.ratingCount || 0);

      if (snapshot.latestFiling || filingCount > 0 || factCount > 0) {
        filingCell.innerHTML = badge("Official SEC Evidence", "verified", `${snapshot.latestFiling?.form || `${filingCount} filing(s)`} · ${factCount} company fact(s)`);
      } else {
        filingCell.innerHTML = badge("Not Yet Stored", "missing", "No filing or company-fact evidence is stored.");
        gaps.push("stored SEC filings or facts");
      }

      if (snapshot.latestQuote) {
        summary.quote += 1;
        quoteCell.innerHTML = badge("External Market Data · May Be Delayed", "verified", `${snapshot.latestQuote.provider || "provider"} · ${snapshot.latestQuote.freshness || "freshness not labeled"}`);
      } else {
        quoteCell.innerHTML = badge("Provider Not Connected", "missing", "No external market-data snapshot is stored.");
        gaps.push("external market-data provider");
      }

      if (ratingCount > 0) {
        summary.rating += 1;
        ratingCell.innerHTML = badge("Stored Rating History", "verified", `${ratingCount} verified database record(s)`);
      } else {
        ratingCell.innerHTML = `${badge("Not Yet Rated", "pending", "No production Monster Rating™ was confirmed.")}${demoBadge(stock)}`;
        gaps.push("verified production rating");
      }
      checkedCell.textContent = formatTime(latestTimestamp(snapshot));
    } else if (storedResult.status === 404) {
      filingCell.innerHTML = badge("Not Yet Stored", "pending", "No persistent production snapshot exists.");
      quoteCell.innerHTML = badge("Provider Not Connected", "pending", "No external market-data snapshot is stored.");
      ratingCell.innerHTML = `${badge("Not Yet Rated", "pending", "No production Monster Rating™ was confirmed.")}${demoBadge(stock)}`;
      checkedCell.textContent = "No stored timestamp";
      gaps.push("stored production snapshot", "external market-data provider", "verified production rating");
    } else {
      filingCell.innerHTML = badge("Provider Not Connected", "error", "Stored SEC evidence could not be checked.");
      quoteCell.innerHTML = badge("Provider Not Connected", "error", "External market-data status could not be checked.");
      ratingCell.innerHTML = `${badge("Not Yet Rated", "pending", "No production Monster Rating™ was confirmed.")}${demoBadge(stock)}`;
      checkedCell.textContent = "Not checked";
      gaps.push("production database connection", "verified production rating");
    }

    gapCell.textContent = gaps.length ? `Still needed: ${[...new Set(gaps)].join(", ")}.` : "No evidence gap detected in the fields checked by this ledger.";
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
    setSummary({ sec: "…", stored: "…", quote: "…", rating: "…" });

    try {
      const healthResult = await request("/api/health");
      const problem = healthProblem(healthResult);
      if (problem) {
        setProviderFailure(problem);
        return;
      }

      const summary = { sec: 0, stored: 0, quote: 0, rating: 0 };
      setSummary(summary);
      const queue = [...CASES];
      const workers = Array.from({ length: 3 }, async () => {
        while (queue.length) {
          const stock = queue.shift();
          if (!stock) return;
          await verifyStock(stock, summary);
          setSummary(summary);
        }
      });
      await Promise.all(workers);
      if (timestampNode) timestampNode.textContent = `LAST CHECKED ${formatTime(Date.now()).toUpperCase()}`;
    } finally {
      verificationInFlight = false;
      runButton.disabled = false;
      runButton.textContent = "RUN VERIFICATION AGAIN";
    }
  }

  seedRows();
  setSummary();
  runButton?.addEventListener("click", () => void runVerification());

  if (apiBaseUrl) void runVerification();
  else setProviderFailure("The public API address is not configured.");
})();
