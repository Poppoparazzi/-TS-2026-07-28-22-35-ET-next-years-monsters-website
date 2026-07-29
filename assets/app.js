// TS: 2026-07-29 09:10 ET
const DEMO_NOTICE = "Illustrative demonstration only. This is not live market data, current news, investment advice, or a recommendation.";
const EDUCATIONAL_DISCLAIMER = "Monster Rating™ is an educational framework for organizing evidence. It is not a buy, sell, or hold recommendation, does not predict future performance, and may become outdated as company results, prices, market conditions, and verified news change. Investing involves risk, including possible loss of principal.";

const DEMO_OUTLOOK = {
  AAPL: {
    raise: "Stronger services growth, renewed device momentum, expanding margins, and convincing evidence that new products are adding durable revenue could support a higher demonstration rating.",
    lower: "Slower ecosystem growth, weakening demand, margin pressure, or evidence that premium expectations are outrunning business results could lower the demonstration rating.",
    watch: "Watch services growth, installed-base activity, product-cycle demand, margins, cash returns, and whether price strength is confirmed by improving business evidence."
  },
  NVDA: {
    raise: "Sustained data-center growth, durable demand visibility, margin resilience, and continued platform leadership could support the already elevated demonstration rating.",
    lower: "Demand normalization, customer concentration, competitive pressure, supply constraints, or results that fail to meet extreme expectations could lower the demonstration rating.",
    watch: "Watch data-center revenue, gross margin, product transitions, customer demand, competitive responses, and whether price action remains supported by actual earnings growth."
  },
  MNST: {
    raise: "Faster international growth, successful category expansion, steady margins, and deeper distribution could support a higher demonstration rating.",
    lower: "Slower category growth, weaker brand momentum, distribution disruption, or sustained margin pressure could lower the demonstration rating.",
    watch: "Watch unit growth, international expansion, market share, pricing, margins, and whether new products strengthen the long-term brand moat."
  },
  AMZN: {
    raise: "Faster AWS growth, stronger advertising results, better retail margins, and continued operating leverage could support a higher demonstration rating.",
    lower: "Cloud deceleration, consumer weakness, rising fulfillment costs, regulation, or renewed margin compression could lower the demonstration rating.",
    watch: "Watch AWS growth, advertising, retail operating income, capital spending, free cash flow, and whether scale continues to produce better margins."
  },
  TSLA: {
    raise: "Improving vehicle margins, credible volume growth, stronger execution, and measurable progress in software or autonomy could support a higher demonstration rating.",
    lower: "Further margin pressure, slowing demand, execution setbacks, intensifying competition, or sentiment unsupported by results could lower the demonstration rating.",
    watch: "Watch deliveries, pricing, automotive margin, free cash flow, product timelines, competitive share, and evidence that software ambitions are becoming financial results."
  },
  NFLX: {
    raise: "Stronger advertising contribution, durable pricing power, improving engagement, and expanding free cash flow could support a higher demonstration rating.",
    lower: "Weak engagement, rising content costs, slower subscriber economics, or disappointing advertising progress could lower the demonstration rating.",
    watch: "Watch revenue growth, operating margin, engagement, advertising scale, content efficiency, and the durability of pricing power."
  },
  AMD: {
    raise: "Share gains, stronger data-center execution, improving AI accelerator adoption, and expanding margins could support a higher demonstration rating.",
    lower: "Product delays, weaker competitive positioning, semiconductor cyclicality, or disappointing data-center growth could lower the demonstration rating.",
    watch: "Watch data-center revenue, product roadmaps, AI adoption, gross margin, competitive benchmarks, and whether execution converts opportunity into sustained earnings growth."
  },
  COST: {
    raise: "Steady membership growth, renewal strength, resilient comparable sales, and disciplined expansion could support a higher demonstration rating.",
    lower: "Membership softness, slowing traffic, margin pressure, or valuation compression despite solid operations could lower the demonstration rating.",
    watch: "Watch renewal rates, traffic, comparable sales, membership fee economics, margins, new-club productivity, and the gap between business quality and valuation."
  },
  VRT: {
    raise: "Continued data-center demand, backlog conversion, margin expansion, and durable power-and-cooling leadership could support a higher demonstration rating.",
    lower: "Order normalization, project delays, margin disappointment, customer concentration, or a broad reset in AI-infrastructure spending could lower the demonstration rating.",
    watch: "Watch orders, backlog, data-center capital spending, margins, capacity execution, and whether thematic demand becomes durable cash flow."
  },
  AXON: {
    raise: "Faster recurring-software growth, broader ecosystem adoption, strong retention, and disciplined expansion could support a higher demonstration rating.",
    lower: "Slower bookings, procurement delays, valuation pressure, execution problems, or weaker software economics could lower the demonstration rating.",
    watch: "Watch annual recurring revenue, bookings, customer retention, software mix, contract timing, margins, and expansion across the public-safety ecosystem."
  },
  DECK: {
    raise: "Sustained brand momentum, international growth, disciplined distribution, and resilient margins could support a higher demonstration rating.",
    lower: "Fashion-cycle weakness, inventory problems, slowing demand, discounting, or margin compression could lower the demonstration rating.",
    watch: "Watch brand-level sales, direct-to-consumer demand, inventory, international growth, margins, and whether category expansion remains disciplined."
  },
  WING: {
    raise: "Strong same-store sales, productive unit growth, durable franchise economics, and successful international expansion could support a higher demonstration rating.",
    lower: "Traffic weakness, food-cost pressure, slower unit openings, franchise strain, or valuation compression could lower the demonstration rating.",
    watch: "Watch same-store sales, unit openings, franchisee returns, food costs, digital mix, international development, and the durability of brand momentum."
  },
  META: {
    raise: "Stronger engagement, improving ad efficiency, disciplined spending, and monetization of AI-driven products could support a higher demonstration rating.",
    lower: "Regulatory pressure, weaker advertising demand, uncontrolled capital spending, engagement erosion, or platform disruption could lower the demonstration rating.",
    watch: "Watch advertising growth, engagement, operating margin, capital expenditures, AI-driven monetization, regulatory developments, and free cash flow."
  },
  APP: {
    raise: "Sustained software growth, broader customer adoption, durable margin expansion, and verified evidence of product effectiveness could support a higher demonstration rating.",
    lower: "Customer concentration, slowing growth, platform-policy changes, weaker margins, or evidence that expectations exceed repeatable results could lower the demonstration rating.",
    watch: "Watch software revenue, customer concentration, margins, product adoption, cash flow, platform dependencies, and whether momentum is supported by durable fundamentals."
  },
  MSFT: {
    raise: "Faster cloud growth, measurable AI monetization, durable recurring revenue, and strong operating leverage could support the already elevated demonstration rating.",
    lower: "Cloud deceleration, weak returns on heavy capital spending, margin pressure, regulation, or slower enterprise demand could lower the demonstration rating.",
    watch: "Watch Azure growth, AI revenue contribution, capital expenditures, cloud margins, enterprise demand, recurring revenue, and free cash flow."
  }
};

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    if (status) status.textContent = "";
    audio.currentTime = 0;
    try {
      await audio.play();
      button.textContent = "Playing the TuneTank Bull…";
    } catch (error) {
      button.textContent = "Play Approved Bull Sound";
      if (status) status.textContent = "The approved TuneTank WAV must be placed at assets/tunetank-bull-mad-mooing.wav.";
    }
  });
  audio.addEventListener("ended", () => {
    button.textContent = "Play Approved Bull Sound";
    if (status) status.textContent = "That is the approved bull. No suspicious substitute mooing.";
  });
}

function getDemoOutlook(stock) {
  return DEMO_OUTLOOK[stock.ticker] || {
    raise: `Verified evidence strengthening ${stock.dna[0]} and ${stock.dna[1]} could support a higher demonstration rating.`,
    lower: `Evidence that the stated risk is becoming material, or deterioration in ${stock.dna[2]}, could lower the demonstration rating.`,
    watch: `Watch future company reports for measurable evidence involving ${stock.dna.join(", ")}.`
  };
}

function renderMissingResult(result, query) {
  const safeQuery = escapeHtml(query || "No ticker entered");
  result.style.display = "block";
  result.innerHTML = `
    <div class="monster-empty-state">
      <p class="monster-demo-flag">15-STOCK EDUCATIONAL DEMONSTRATION</p>
      <h2>${safeQuery}</h2>
      <p>This working version contains the 15 stocks from the book’s Visual Case Library. A licensed market-data service and scoring backend are required before other U.S. tickers can receive a current, verified Monster Rating™.</p>
      <div class="monster-education-disclaimer"><strong>DEMONSTRATION NOTICE:</strong> ${escapeHtml(DEMO_NOTICE)}</div>
    </div>`;
}

function renderStockResult(result, stock) {
  const cssTier = tierClass(stock.score);
  const outlook = getDemoOutlook(stock);
  const dna = stock.dna.map(item => `<span class="dna">${escapeHtml(item)}</span>`).join("");
  const impactLogic = `No current headline has been loaded. In the future licensed version, verified news that strengthens ${stock.dna[0]} or ${stock.dna[1]} may support the rating, while news confirming the stated risk may reduce it.`;

  result.style.display = "block";
  result.innerHTML = `
    <div class="monster-result-head">
      <div class="monster-result-identity">
        <p class="monster-demo-flag">DEMONSTRATION RATING · NOT LIVE DATA</p>
        <h2><span>$${escapeHtml(stock.ticker)}</span> ${escapeHtml(stock.name)}</h2>
        <p class="monster-result-sector">${escapeHtml(stock.sector)} · 15-STOCK VISUAL CASE LIBRARY DEMO</p>
      </div>
      <div class="monster-score-card ${cssTier}" aria-label="Demonstration Monster Rating ${escapeHtml(stock.score)} out of 100, ${escapeHtml(stock.tier)}">
        <span>DEMO MONSTER RATING™</span>
        <strong>${escapeHtml(stock.score)}</strong>
        <em>${escapeHtml(stock.tier)}</em>
      </div>
    </div>

    <div class="monster-result-grid">
      <section class="monster-result-panel">
        <span>01 / EVIDENCE</span>
        <h3>WHY THE STOCK RATES THERE</h3>
        <p>${escapeHtml(stock.why)}</p>
      </section>
      <section class="monster-result-panel monster-result-panel-risk">
        <span>02 / RISK</span>
        <h3>RISK WARNING</h3>
        <p>${escapeHtml(stock.warning)}</p>
      </section>
    </div>

    <section class="monster-dna-section">
      <div class="monster-dna-heading">
        <span class="monster-section-label">03 / TRAITS</span>
        <h3>MONSTER DNA™</h3>
      </div>
      <div class="monster-dna-list">${dna}</div>
    </section>

    <section class="monster-news-section">
      <div class="monster-news-copy">
        <span class="monster-section-label">04 / DEMONSTRATION PLACEHOLDER</span>
        <h3>RECENT NEWS &amp; RATING IMPACT</h3>
        <p>${escapeHtml(impactLogic)}</p>
      </div>
      <div class="monster-news-status">
        <strong>NO LIVE NEWS CONNECTED</strong>
        <span>The production version will show a verified headline, publisher, source link, publication time, retrieval timestamp, and explainable rating impact.</span>
      </div>
    </section>

    <div class="monster-trigger-grid">
      <section class="monster-trigger monster-trigger-raise">
        <span class="monster-section-label">05 / UPSIDE EVIDENCE</span>
        <h3>WHAT COULD RAISE THE RATING</h3>
        <p>${escapeHtml(outlook.raise)}</p>
      </section>
      <section class="monster-trigger monster-trigger-lower">
        <span class="monster-section-label">06 / DETERIORATION</span>
        <h3>WHAT COULD LOWER THE RATING</h3>
        <p>${escapeHtml(outlook.lower)}</p>
      </section>
      <section class="monster-trigger monster-trigger-watch">
        <span class="monster-section-label">07 / NEXT CHECK</span>
        <h3>WHAT TO WATCH NEXT</h3>
        <p>${escapeHtml(outlook.watch)}</p>
      </section>
    </div>

    <div class="monster-education-disclaimer">
      <strong>EDUCATIONAL DISCLAIMER:</strong> ${escapeHtml(EDUCATIONAL_DISCLAIMER)}
    </div>`;
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
    result.innerHTML = `<div class="monster-empty-state"><h2>DATA FILE DID NOT LOAD</h2><p>Open this site through a local web server or deployed host rather than double-clicking the file.</p></div>`;
    return;
  }

  const byTicker = new Map(stocks.map(stock => [stock.ticker.toUpperCase(), stock]));
  const byName = new Map(stocks.map(stock => [stock.name.toUpperCase(), stock]));

  const findStock = (query) => {
    if (!query) return null;
    return byTicker.get(query) ||
      byName.get(query) ||
      stocks.find(stock => stock.name.toUpperCase().includes(query));
  };

  const render = (stock, query = "") => {
    if (!stock) {
      renderMissingResult(result, query);
      return;
    }
    renderStockResult(result, stock);
  };

  const run = () => {
    const query = input.value.trim().toUpperCase();
    render(findStock(query), query);
  };

  button.addEventListener("click", run);
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") run();
  });

  if (suggestions) {
    ["AAPL", "NVDA", "MNST", "AMZN", "VRT", "AXON"].forEach(ticker => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = ticker;
      chip.addEventListener("click", () => {
        input.value = ticker;
        render(byTicker.get(ticker), ticker);
      });
      suggestions.appendChild(chip);
    });
  }

  input.value = "NVDA";
  render(byTicker.get("NVDA"), "NVDA");
}

document.addEventListener("DOMContentLoaded", () => {
  setupMascotFallback();
  setupBullSound();
  setupMonsterCheck();
});
