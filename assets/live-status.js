// TS: 2026-07-29 16:41 ET

function statusEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusCheck(label, ready, detail) {
  return `
    <div class="status-check ${ready ? "status-check-ready" : "status-check-pending"}">
      <span aria-hidden="true">${ready ? "✓" : "○"}</span>
      <div><strong>${statusEscape(label)}</strong><small>${statusEscape(detail)}</small></div>
    </div>`;
}

function statusRow(stock, index) {
  const firstTarget = stock.ticker === "AAPL";
  return `
    <article class="status-row">
      <div class="status-company">
        <strong>${String(index + 1).padStart(2, "0")} · $${statusEscape(stock.ticker)}</strong>
        <span>${statusEscape(stock.name)} · ${statusEscape(stock.sector)}</span>
      </div>
      ${statusCheck("DEMO PROFILE", true, "Published")}
      ${statusCheck("LIVE QUOTE", false, "Secure backend not deployed")}
      ${statusCheck("SEC CHECK", false, "Not saved to database")}
      ${statusCheck("LIVE RATING", false, "Version 1 not calculated")}
      <div class="status-result">
        <strong>${firstTarget ? "FIRST TECHNICAL TARGET" : "PENDING"}</strong>
        <span>${firstTarget ? "AAPL will test the complete live path first. This is not a recommendation." : "Follows after the first ticker passes twice."}</span>
      </div>
    </article>`;
}

async function setupLiveStatus() {
  const list = document.querySelector("[data-status-list]");
  if (!list) return;

  try {
    const response = await fetch("data/stocks.json");
    if (!response.ok) throw new Error("Unable to load the pilot stock list.");

    const stocks = await response.json();
    const ordered = [...stocks].sort((left, right) => left.ticker.localeCompare(right.ticker));
    list.innerHTML = ordered.map(statusRow).join("");
  } catch (_error) {
    list.innerHTML = "<p class=\"leaderboard-empty\">The live rollout checklist could not load its stock list. No completion status was invented.</p>";
  }
}

document.addEventListener("DOMContentLoaded", setupLiveStatus);
