// TS: 2026-08-09 08:17 ET

function installHomeCheckDetective() {
  const heading = document.querySelector(".home-check-heading");
  if (!heading) return;

  // The direct HTML fallback may still contain the older Captain Breakout block.
  // Remove that stale mascot before installing the current approved Detective Break artwork.
  heading.querySelectorAll(".home-check-captain-direct").forEach((node) => node.remove());
  if (heading.querySelector(".home-check-detective")) return;

  const style = document.createElement("style");
  style.id = "home-check-detective-styles";
  style.textContent = `
    .home-check-heading{position:relative;overflow:hidden}
    .home-check-detective{margin:20px 0 0;display:flex;align-items:flex-end;justify-content:center;min-height:690px}
    .home-check-detective img{display:block;width:min(470px,100%);height:690px;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 24px 36px rgba(0,0,0,.52))}
    @media(max-width:1050px){.home-check-detective{min-height:500px}.home-check-detective img{width:min(360px,86%);height:500px}}
    @media(max-width:650px){.home-check-detective{margin-top:18px;min-height:390px}.home-check-detective img{width:min(290px,82%);height:390px}}
  `;
  document.head.appendChild(style);

  const figure = document.createElement("figure");
  figure.className = "home-check-detective";
  figure.setAttribute("aria-label", "Detective Break investigating the Monster Check evidence");
  figure.innerHTML = `
    <img src="assets/detective-break-actual.svg" alt="Detective Break, the tall green financial investigator, examining stock evidence">
  `;
  heading.appendChild(figure);
}

function installHomeCheckReadability() {
  if (document.getElementById("home-check-readability-styles")) return;

  const style = document.createElement("style");
  style.id = "home-check-readability-styles";
  style.textContent = `
    .home-page .monster-rating-trio-card strong{
      font-size:clamp(21px,1.65vw,28px)!important;
      line-height:.98!important;
      word-break:normal!important;
      overflow-wrap:normal!important;
      hyphens:none!important;
    }
    .home-page .monster-rating-trio-card:nth-child(3) strong{
      font-size:clamp(20px,1.5vw,26px)!important;
    }
    .home-page .home-suggestions{
      display:grid!important;
      grid-template-columns:repeat(8,minmax(0,1fr));
      gap:8px!important;
      align-items:stretch;
    }
    .home-page .home-suggestions .chip{
      width:100%;
      min-width:0;
      margin:0!important;
      text-align:center;
    }
    .home-page .home-quick-pick-note{
      grid-column:1/-1;
      color:#9da69f;
      font-size:9px;
      font-weight:900;
      letter-spacing:.04em;
      padding-top:2px;
    }
    @media(max-width:1250px){
      .home-page .home-suggestions{grid-template-columns:repeat(6,minmax(0,1fr))}
    }
    @media(max-width:850px){
      .home-page .home-suggestions{grid-template-columns:repeat(4,minmax(0,1fr))}
      .home-page .monster-rating-trio-card strong{font-size:28px!important}
    }
    @media(max-width:520px){
      .home-page .home-suggestions{grid-template-columns:repeat(3,minmax(0,1fr))}
    }
  `;
  document.head.appendChild(style);
}

function expandHomeQuickPicks() {
  const suggestions = document.querySelector(".home-suggestions[data-suggestions]");
  const input = document.querySelector("[data-ticker-input]");
  const button = document.querySelector("[data-rate-button]");
  if (!suggestions || !input || !button) return;

  const tickers = [
    "AAPL", "CRDO", "NVDA", "TSLA", "AMZN", "MSFT", "META", "AMD",
    "COST", "NFLX", "MNST", "VRT", "AXON", "DECK", "WING", "APP"
  ];

  const build = () => {
    if (suggestions.dataset.expandedQuickPicks === "true") return true;
    if (!suggestions.querySelector(".chip")) return false;

    suggestions.dataset.expandedQuickPicks = "true";
    suggestions.innerHTML = "";

    tickers.forEach((ticker) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = ticker;
      chip.addEventListener("click", () => {
        input.value = ticker;
        button.click();
      });
      suggestions.appendChild(chip);
    });

    const note = document.createElement("span");
    note.className = "home-quick-pick-note";
    note.textContent = "QUICK PICKS ONLY · ENTER ANY COVERED U.S. TICKER ABOVE";
    suggestions.appendChild(note);
    return true;
  };

  if (build()) return;

  const observer = new MutationObserver(() => {
    if (build()) observer.disconnect();
  });
  observer.observe(suggestions, { childList: true, subtree: true });

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (build() || attempts >= 100) {
      window.clearInterval(timer);
      observer.disconnect();
    }
  }, 100);
}

function restoreHomeMonsterCheckData() {
  const result = document.querySelector(".home-result-card[data-result]");
  const suggestions = document.querySelector(".home-suggestions[data-suggestions]");
  if (!result || !suggestions) return;

  const hasVisibleResult = () =>
    result.style.display !== "none" && result.innerHTML.trim().length > 0;

  const clickNvdaIfReady = () => {
    if (hasVisibleResult()) return true;

    const nvda = Array.from(suggestions.querySelectorAll(".chip"))
      .find((chip) => chip.textContent.trim().toUpperCase() === "NVDA");
    if (!nvda) return false;

    // Do not mark restoration complete just because the click fired.
    // app.js can still clear the result later in the same setup cycle.
    // Keep checking until the NVIDIA card is actually visible and populated.
    nvda.click();
    return false;
  };

  const observer = new MutationObserver(() => {
    clickNvdaIfReady();
  });
  observer.observe(suggestions, { childList: true, subtree: true });

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;

    if (hasVisibleResult()) {
      window.clearInterval(timer);
      observer.disconnect();
      return;
    }

    clickNvdaIfReady();

    if (attempts >= 100) {
      window.clearInterval(timer);
      observer.disconnect();
    }
  }, 100);
}

function startHomeStockFinder() {
  installHomeCheckDetective();
  installHomeCheckReadability();
  expandHomeQuickPicks();
  restoreHomeMonsterCheckData();

  const form = document.querySelector("[data-home-stock-finder]");
  const input = document.querySelector("[data-home-stock-finder-input]");
  if (!form || !input) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = input.value.trim();
    const exactTicker = query.toUpperCase();
    const isExactTicker = /^[A-Z0-9.-]{1,15}$/.test(query) && !query.includes(" ");
    const url = new URL(
      isExactTicker ? "market-explorer.html" : "coverage-universe.html",
      window.location.href,
    );
    if (isExactTicker) {
      url.searchParams.set("left", exactTicker);
      url.searchParams.set("mode", "single");
    } else if (query) {
      url.searchParams.set("q", query);
    }
    window.location.href = url.toString();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startHomeStockFinder);
} else {
  startHomeStockFinder();
}
