// TS: 2026-07-29 16:33 ET

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

function rolloutStage(label, status, detail) {
  const ready = status === "ready";
  return `
    <div class="rollout-stage rollout-stage-${ready ? "ready" : "pending"}">
      <span aria-hidden="true">${ready ? "✓" : "○"}</span>
      <div><strong>${leaderboardEscape(label)}</strong><small>${leaderboardEscape(detail)}</small></div>
    </div>`;
}

function rolloutRow(stock, index) {
  const order = String(index + 1).padStart(2, "0");
  return `
    <article class="rollout-row">
      <div class="rollout-company">
        <span>${order}</span>
        <div><strong>$${leaderboardEscape(stock.ticker)}</strong><small>${leaderboardEscape(stock.name)}</small></div>
      </div>
      ${rolloutStage("DEMO PROFILE", "ready", "Published")}
      ${rolloutStage("LIVE QUOTE", "pending", "Backend not deployed")}
      ${rolloutStage("SEC CHECK", "pending", "Not saved yet")}
      ${rolloutStage("LIVE RATING", "pending", "Version 1 not calculated")}
      <div class="rollout-row-status"><strong>NOT LIVE YET</strong><span>Waiting for the first secure data run.</span></div>
    </article>`;
}

async function setupLeaderboard() {
  const list = document.querySelector("[data-leaderboard-list]");
  const rolloutList = document.querySelector("[data-rollout-list]");
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
    if (rolloutList) rolloutList.innerHTML = ranked.map(rolloutRow).join("");
    if (count) count.textContent = `${ranked.length}-STOCK PILOT`;
  } catch (error) {
    list.innerHTML = `<p class="leaderboard-empty">The demonstration ranking file did not load. The page is refusing to fabricate a leaderboard, which is inconvenient but civilized.</p>`;
    if (rolloutList) {
      rolloutList.innerHTML = `<p class="leaderboard-empty">The rollout checklist could not load because its stock list is unavailable. No completion status was invented.</p>`;
    }
  }

  const runSearch = () => openMonsterCheck(input?.value);
  button?.addEventListener("click", runSearch);
  input?.addEventListener("keydown", event => {
    if (event.key === "Enter") runSearch();
  });
}

document.addEventListener("DOMContentLoaded", setupLeaderboard);