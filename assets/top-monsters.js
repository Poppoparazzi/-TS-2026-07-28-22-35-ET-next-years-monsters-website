// TS: 2026-07-29 10:50 ET

function leaderboardEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openMonsterCheck(ticker) {
  const symbol = String(ticker ?? "").trim().toUpperCase();
  if (!symbol) return;
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
        <span>${leaderboardEscape(stock.tier)}</span>
      </div>
      <p class="leaderboard-evidence">${leaderboardEscape(stock.why)}</p>
      <a class="leaderboard-link" href="monster-check.html?ticker=${encodeURIComponent(stock.ticker)}">OPEN MONSTER CHECK™</a>
    </article>`;
}

async function setupLeaderboard() {
  const list = document.querySelector("[data-leaderboard-list]");
  const count = document.querySelector("[data-leaderboard-count]");
  const input = document.querySelector("[data-leaderboard-input]");
  const button = document.querySelector("[data-leaderboard-button]");
  if (!list) return;

  try {
    const response = await fetch("data/stocks.json");
    if (!response.ok) throw new Error("Unable to load demonstration rankings.");
    const stocks = await response.json();
    const ranked = [...stocks].sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker));
    list.innerHTML = ranked.map(leaderboardRow).join("");
    if (count) count.textContent = `${ranked.length}-STOCK PILOT`;
  } catch (error) {
    list.innerHTML = `<p class="leaderboard-empty">The demonstration ranking file did not load. The page is refusing to fabricate a leaderboard, which is inconvenient but civilized.</p>`;
  }

  const runSearch = () => openMonsterCheck(input?.value);
  button?.addEventListener("click", runSearch);
  input?.addEventListener("keydown", event => {
    if (event.key === "Enter") runSearch();
  });
}

document.addEventListener("DOMContentLoaded", setupLeaderboard);
