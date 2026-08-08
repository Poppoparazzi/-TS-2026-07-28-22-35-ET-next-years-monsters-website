// TS: 2026-08-08 19:14 ET

function tierEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function caseLink(ticker) {
  return `monster-check.html?ticker=${encodeURIComponent(ticker)}`;
}

function topRow(stock, index) {
  const rank = String(index + 1).padStart(2, "0");
  return `
    <article class="tier-row">
      <div class="tier-rank">${rank}</div>
      <div class="tier-company"><strong>$${tierEscape(stock.ticker)}</strong><span>${tierEscape(stock.name)}</span></div>
      <div class="tier-score"><strong>${tierEscape(stock.score_status ?? stock.score ?? "SCORING")}</strong><span>${tierEscape(stock.status)}</span></div>
      <div class="tier-copy"><strong>WHY IT'S HERE</strong><p>${tierEscape(stock.why)}</p></div>
      <div class="tier-copy tier-copy-risk"><strong>BIGGEST CONCERN / WHAT COULD PROVE US WRONG</strong><p>${tierEscape(stock.risk)}</p></div>
      <a class="tier-case-link" href="${caseLink(stock.ticker)}">OPEN CASE FILE →</a>
    </article>`;
}

function tierCard(stock, tier) {
  const nextLabel = tier === "rising" ? "WHAT COULD EARN A PROMOTION" : tier === "watchlist" ? "WHAT WE NEED TO SEE" : "WHAT CHANGED";
  const nextText = tier === "dropped" ? stock.drop_reason : stock.next;
  const score = stock.score_status ?? stock.score;
  return `
    <article class="tier-card">
      <div class="tier-card-head">
        <div><strong>$${tierEscape(stock.ticker)}</strong><span>${tierEscape(stock.name)}</span></div>
        <div class="tier-card-badges">${score != null ? `<strong class="tier-card-score">${tierEscape(score)}</strong>` : ""}<span class="tier-card-status">${tierEscape(stock.status)}</span></div>
      </div>
      <p><strong>WHY WE'RE WATCHING:</strong> ${tierEscape(stock.why)}</p>
      <p class="tier-card-risk"><strong>CONCERN:</strong> ${tierEscape(stock.risk)}</p>
      <p class="tier-card-next"><strong>${nextLabel}:</strong> ${tierEscape(nextText)}</p>
      <a class="tier-case-link" href="${caseLink(stock.ticker)}">OPEN CASE FILE →</a>
    </article>`;
}

function renderTier(list, items, tier) {
  if (!list) return;
  if (!items.length) {
    list.innerHTML = `<div class="tier-empty">No ${tier === "dropped" ? "Dropped Cases™ yet. History begins with the first official dated snapshot, so we will not manufacture a past that did not exist." : "companies in this tier yet."}</div>`;
    return;
  }
  list.innerHTML = tier === "top15" ? items.map(topRow).join("") : items.map(item => tierCard(item, tier)).join("");
}

function updateBoardStatusCopy(data) {
  const snapshotStatus = document.querySelector(".tier-snapshot-bar strong");
  if (snapshotStatus) snapshotStatus.textContent = "SCORED RESEARCH BOARD · * = PENDING COMPONENT · NOT INVESTMENT ADVICE";

  const notes = document.querySelectorAll(".tier-method-note p");
  if (notes.length > 1) {
    const pending = [...(data.top15 || []), ...(data.rising || []), ...(data.watchlist || [])]
      .filter(item => String(item.score_status || "").includes("*"))
      .map(item => item.ticker);
    notes[1].innerHTML = `<strong>MARKET / RELATIVE-STRENGTH PASS:</strong> The standardized review is complete for the published scored names except ${pending.length ? tierEscape(pending.join(", ")) : "none"}. An asterisk marks only a required component that is still pending. Completed scores remain research rankings and can change when new evidence changes.`;
  }
}

async function setupTierPreview() {
  try {
    const response = await fetch("data/monster-tier-board-preview.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load tier preview data.");
    const data = await response.json();

    document.querySelector("[data-snapshot-date]").textContent = `Research Snapshot: ${data.snapshot_label}`;
    const method = document.querySelector("[data-score-method]");
    if (method && data.score_method) method.textContent = data.score_method;
    ["top15", "rising", "watchlist", "dropped"].forEach(tier => {
      const items = data[tier] || [];
      const count = document.querySelector(`[data-count="${tier}"]`);
      if (count) count.textContent = items.length;
      renderTier(document.querySelector(`[data-tier-list="${tier}"]`), items, tier);
    });
    updateBoardStatusCopy(data);
  } catch (error) {
    document.querySelectorAll("[data-tier-list]").forEach(list => {
      list.innerHTML = `<div class="tier-empty">The research board data did not load. No rankings were fabricated.</div>`;
    });
  }
}

document.addEventListener("DOMContentLoaded", setupTierPreview);
