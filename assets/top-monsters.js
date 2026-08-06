// TS: 2026-08-04 12:33 ET

function leaderboardEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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

function setLeaderboardText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = String(value);
}

function openMonsterCheck(ticker) {
  const symbol = String(ticker ?? "").trim().toUpperCase();
  const message = document.querySelector("[data-search-message]");
  if (!symbol) {
    if (message) message.textContent = "Enter a ticker symbol before opening Monster Check™.";
    return;
  }
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) {
    if (message) message.textContent = "Use a valid ticker containing letters, numbers, a period, or a hyphen.";
    return;
  }
  window.location.href = `monster-check.html?ticker=${encodeURIComponent(symbol)}`;
}

function leaderboardRow(stock, index) {
  const rank = String(index + 1).padStart(2, "0");
  return `
    <article class="leaderboard-row">
      <div class="leaderboard-rank">${rank}</div>
      <div class="leaderboard-company">
        <strong>$${leaderboardEscape(stock.ticker)}</strong>
        <span>${leaderboardEscape(stock.name)}</span>
      </div>
      <div class="leaderboard-sector">${leaderboardEscape(stock.sector)}</div>
      <div class="leaderboard-score">
        <strong>${leaderboardEscape(stock.score)}</strong>
        <span>${leaderboardEscape(stock.tier)} · DEMONSTRATION RATING</span>
      </div>
      <p class="leaderboard-evidence">${leaderboardEscape(stock.why)}</p>
      <a class="leaderboard-link" href="monster-check.html?ticker=${encodeURIComponent(stock.ticker)}">OPEN DEMONSTRATION MONSTER CHECK™</a>
    </article>`;
}

async function requestJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || `Request returned HTTP ${response.status}.`);
  return payload;
}

function renderProductionUnavailable(message) {
  setLeaderboardText("[data-production-status]", `${message} Provider Not Connected. No production totals were invented.`);
  [
    "[data-production-universe]",
    "[data-production-complete]",
    "[data-production-unresolved]",
    "[data-production-quotes]",
    "[data-production-ratings]",
  ].forEach((selector) => setLeaderboardText(selector, "—"));
}

async function loadProductionStatus() {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) {
    renderProductionUnavailable("The public API address is not configured.");
    return;
  }

  try {
    const payload = await requestJson(`${baseUrl}/api/universe/status?limit=2000`);
    setLeaderboardText("[data-production-universe]", payload.universeSize ?? payload.companies?.length ?? 0);
    setLeaderboardText("[data-production-complete]", payload.secCompleteCount ?? 0);
    setLeaderboardText("[data-production-unresolved]", payload.unresolvedCount ?? 0);
    setLeaderboardText("[data-production-quotes]", payload.quoteCompleteCount ?? 0);
    setLeaderboardText("[data-production-ratings]", payload.ratingCompleteCount ?? 0);

    const complete = Number(payload.secCompleteCount ?? 0);
    const unresolved = Number(payload.unresolvedCount ?? 0);
    const ratings = Number(payload.ratingCompleteCount ?? 0);
    const ratingLabel = ratings > 0 ? `${ratings} production ratings saved.` : "Companies remain Not Yet Rated.";
    setLeaderboardText(
      "[data-production-status]",
      `${complete} companies have Official SEC Evidence; ${unresolved} have Unresolved SEC Identity. ${ratingLabel}`,
    );
  } catch (error) {
    renderProductionUnavailable(error instanceof Error ? error.message : "The production evidence service could not be reached.");
  }
}

async function setupLeaderboard() {
  const list = document.querySelector("[data-leaderboard-list]");
  const count = document.querySelector("[data-leaderboard-count]");
  const input = document.querySelector("[data-leaderboard-input]");
  const button = document.querySelector("[data-leaderboard-button]");
  if (!list) return;

  try {
    const response = await fetch(window.NYM_STATIC_URL?.("data/stocks.json") || "data/stocks.json", { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error("Unable to load demonstration rankings.");
    const stocks = await response.json();
    if (!Array.isArray(stocks)) throw new Error("The demonstration ranking file is invalid.");
    const ranked = [...stocks].sort((a, b) => Number(b.score) - Number(a.score) || String(a.ticker).localeCompare(String(b.ticker)));
    list.innerHTML = ranked.map(leaderboardRow).join("");
    if (count) count.textContent = `${ranked.length}-STOCK PILOT`;
  } catch (_error) {
    list.innerHTML = "<p class=\"leaderboard-empty\">The demonstration ranking file did not load. No leaderboard or ratings were fabricated.</p>";
  }

  const runSearch = () => openMonsterCheck(input?.value);
  button?.addEventListener("click", runSearch);
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runSearch();
  });

  await loadProductionStatus();
}

document.addEventListener("DOMContentLoaded", () => void setupLeaderboard());
