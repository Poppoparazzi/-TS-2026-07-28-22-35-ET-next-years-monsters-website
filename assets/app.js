// TS: 2026-07-29 07:24 ET
const DEMO_NOTICE = "Illustrative demo score, not live market data or a recommendation.";

async function loadStocks() {
  const response = await fetch("data/stocks.json");
  if (!response.ok) throw new Error("Unable to load demo stock data.");
  return response.json();
}

function tierClass(score) {
  if (score >= 90) return "platinum";
  if (score >= 75) return "gold";
  if (score >= 60) return "silver";
  return "goblin";
}

function setupMascotFallback() {
  const image = document.querySelector("[data-captain-image]");
  const placeholder = document.querySelector("[data-captain-placeholder]");
  if (!image || !placeholder) return;

  const showImage = () => {
    image.style.display = "block";
    placeholder.style.display = "none";
  };
  const showPlaceholder = () => {
    image.style.display = "none";
    placeholder.style.display = "grid";
  };

  if (image.complete) {
    image.naturalWidth > 0 ? showImage() : showPlaceholder();
  }
  image.addEventListener("load", showImage);
  image.addEventListener("error", showPlaceholder);
}

function setupBullSound() {
  const button = document.querySelector("[data-bull-button]");
  const audio = document.querySelector("[data-bull-audio]");
  const status = document.querySelector("[data-bull-status]");
  if (!button || !audio) return;

  button.addEventListener("click", async () => {
    status.textContent = "";
    audio.currentTime = 0;
    try {
      await audio.play();
      button.textContent = "Playing the TuneTank Bull…";
    } catch (error) {
      button.textContent = "Play Approved Bull Sound";
      status.textContent = "The approved TuneTank WAV must be placed at assets/tunetank-bull-mad-mooing.wav.";
    }
  });
  audio.addEventListener("ended", () => {
    button.textContent = "Play Approved Bull Sound";
    status.textContent = "That is the approved bull. No suspicious substitute mooing.";
  });
}

async function setupMonsterCheck() {
  const input = document.querySelector("[data-ticker-input]");
  const button = document.querySelector("[data-rate-button]");
  const result = document.querySelector("[data-result]");
  const suggestions = document.querySelector("[data-suggestions]");
  if (!input || !button || !result) return;

  let stocks = [];
  try {
    stocks = await loadStocks();
  } catch (error) {
    result.style.display = "block";
    result.innerHTML = `<strong>Data file did not load.</strong><p>Open this site through a local web server or deployed host rather than double-clicking the file.</p>`;
    return;
  }

  const byTicker = new Map(stocks.map(stock => [stock.ticker, stock]));
  const byName = new Map(stocks.map(stock => [stock.name.toUpperCase(), stock]));

  const render = (stock) => {
    if (!stock) {
      const query = input.value.trim().toUpperCase();
      result.style.display = "block";
      result.innerHTML = `
        <div class="ticker-name">${query || "No ticker entered"}</div>
        <p>This rebuilt demo currently contains the 15 stocks from the book's VCL set. A live market-data API is required before every public ticker can receive a real rating.</p>
        <div class="notice">${DEMO_NOTICE}</div>`;
      return;
    }
    const cssTier = tierClass(stock.score);
    result.style.display = "block";
    result.innerHTML = `
      <div class="result-top">
        <div>
          <div class="ticker-name">${stock.ticker} · ${stock.name}</div>
          <div><strong>${stock.tier}</strong> · ${stock.sector}</div>
        </div>
        <div class="score-badge ${cssTier}">
          <div><strong>${stock.score}</strong><small>Monster Rating™</small></div>
        </div>
      </div>
      <div class="result-grid">
        <div class="result-box"><strong>Why it rates here</strong><p>${stock.why}</p></div>
        <div class="result-box"><strong>Risk warning</strong><p>${stock.warning}</p></div>
      </div>
      <div class="dna-list">${stock.dna.map(item => `<span class="dna">${item}</span>`).join("")}</div>
      <div class="notice">${DEMO_NOTICE}</div>`;
  };

  const run = () => {
    const query = input.value.trim().toUpperCase();
    render(byTicker.get(query) || byName.get(query));
  };

  button.addEventListener("click", run);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") run();
  });

  if (suggestions) {
    ["AAPL","NVDA","MNST","AMZN","VRT","AXON"].forEach(ticker => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = ticker;
      chip.addEventListener("click", () => {
        input.value = ticker;
        render(byTicker.get(ticker));
      });
      suggestions.appendChild(chip);
    });
  }

  input.value = "NVDA";
  render(byTicker.get("NVDA"));
}

document.addEventListener("DOMContentLoaded", () => {
  setupMascotFallback();
  setupBullSound();
  setupMonsterCheck();
});
