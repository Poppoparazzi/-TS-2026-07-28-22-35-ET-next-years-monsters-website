// 2026-07-30

async function startNewsRadarEntryHelp() {
  const heroIntro = document.querySelector(".news-radar-intro");
  const controls = document.querySelector(".news-radar-controls");
  const grid = document.querySelector(".news-radar-grid");
  const select = document.querySelector("[data-news-radar-select]");
  const newsCardHead = document.querySelector("[data-news-radar-feed]")?.closest(".news-radar-card")?.querySelector(".news-radar-card-head");
  const newsFrame = document.querySelector("[data-news-radar-feed]");

  if (!heroIntro || !controls || !grid || !select || !newsCardHead || !newsFrame) return;

  controls.id = "choose-stock";
  grid.id = "current-stories";

  const heroActions = document.createElement("div");
  heroActions.className = "news-radar-hero-actions";
  heroActions.innerHTML = `
    <a href="#current-stories">VIEW CURRENT STORIES ↓</a>
    <a href="#choose-stock">CHOOSE A STOCK</a>
  `;

  const backButton = document.createElement("button");
  backButton.className = "news-radar-back-button";
  backButton.type = "button";
  backButton.textContent = "BACK TO WHERE YOU LEFT OFF";
  backButton.addEventListener("click", () => {
    let cameFromThisSite = false;
    try {
      cameFromThisSite = Boolean(document.referrer)
        && new URL(document.referrer).origin === window.location.origin;
    } catch (_error) {
      cameFromThisSite = false;
    }

    if (cameFromThisSite && window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = "coverage-universe.html";
  });

  heroActions.append(backButton);
  heroIntro.insertAdjacentElement("afterend", heroActions);

  const sourceLink = document.createElement("a");
  sourceLink.className = "news-radar-source-door";
  sourceLink.target = "_blank";
  sourceLink.rel = "noopener nofollow";
  sourceLink.textContent = "OPEN SOURCE NEWS ↗";
  newsCardHead.append(sourceLink);

  const note = document.createElement("p");
  note.className = "news-radar-feed-note";
  note.innerHTML = "<strong>LATEST AVAILABLE EXTERNAL STORIES.</strong> Publication times come from the source. The feed may be delayed or blocked by browser privacy settings; use OPEN SOURCE NEWS if the panel is blank.";
  newsFrame.insertAdjacentElement("afterend", note);

  let stocks = [];
  try {
    const response = await fetch(window.NYM_STATIC_URL?.("data/market-universe.json") || "data/market-universe.json");
    if (!response.ok) throw new Error("Market universe unavailable");
    stocks = await response.json();
  } catch (_error) {
    return;
  }

  const byTicker = new Map(
    stocks.map((stock) => [String(stock.ticker).toUpperCase(), stock]),
  );

  const updateSourceLink = () => {
    const stock = byTicker.get(String(select.value).toUpperCase());
    if (!stock) return;
    const symbol = String(stock.proName || `${stock.exchange || "NASDAQ"}:${stock.ticker}`)
      .replace(":", "-");
    sourceLink.href = `https://www.tradingview.com/symbols/${symbol}/news/`;
    sourceLink.setAttribute("aria-label", `Open ${stock.name} source news in a new tab`);
  };

  select.addEventListener("change", updateSourceLink);
  const observer = new MutationObserver(updateSourceLink);
  observer.observe(select, { childList: true });

  window.setTimeout(updateSourceLink, 0);
  window.setTimeout(updateSourceLink, 350);

  if (window.location.hash === "#current-stories") {
    window.setTimeout(() => grid.scrollIntoView({ block: "start" }), 250);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startNewsRadarEntryHelp);
} else {
  startNewsRadarEntryHelp();
}
