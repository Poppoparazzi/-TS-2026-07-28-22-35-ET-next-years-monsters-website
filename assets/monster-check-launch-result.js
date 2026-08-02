// TS: 2026-08-02 09:24 ET

(function installMonsterCheckLaunchResult() {
  "use strict";

  const LAUNCH_DETAILS = {
    AAPL: {
      tippingPoint: "Services growth and ecosystem economics turned Apple from a device-cycle story into a recurring-revenue compounder.",
      marketWeather: "Mega-cap technology leadership, strong balance sheets, and institutional demand supported durable leaders.",
      moveDriver: "Ecosystem lock-in, services expansion, cash generation, and shareholder returns.",
      explanation: "Apple's demonstration score reflects brand strength, cash flow, services revenue, and institutional support. The lesson is not that size alone creates a Monster. The lesson is that a powerful ecosystem can keep producing evidence long after the obvious breakout."
    },
    NVDA: {
      tippingPoint: "AI infrastructure demand moved from interesting theme to measurable revenue acceleration.",
      marketWeather: "Semiconductors, AI infrastructure, and mega-cap growth were leading the market's strongest risk-on pocket.",
      moveDriver: "Data-center demand, GPU leadership, software ecosystem strength, and explosive earnings revisions.",
      explanation: "NVIDIA's demonstration score is high because price leadership and business evidence lined up at the same time. The chart mattered, but the fundamentals gave the move credibility."
    },
    MNST: {
      tippingPoint: "Monster Beverage proved that a focused brand with distribution power could compound quietly for years.",
      marketWeather: "Consumer winners with pricing power and repeat purchase behavior could lead even when the market ignored them.",
      moveDriver: "Brand power, distribution expansion, high margins, and long-duration compounding.",
      explanation: "Monster Beverage is the reminder that not every Monster screams. Some climb because the business keeps producing repeatable evidence."
    },
    AMZN: {
      tippingPoint: "Amazon shifted from retail scale story to cloud, advertising, and operating-leverage machine.",
      marketWeather: "Investors rewarded platforms that could turn scale into higher-margin businesses.",
      moveDriver: "AWS, advertising growth, logistics scale, margin recovery, and free-cash-flow improvement.",
      explanation: "Amazon's demonstration score reflects the power of multiple engines. The Monster signal improves when several business lines begin supporting the same thesis."
    },
    TSLA: {
      tippingPoint: "Tesla's early leadership came when the market began treating electric vehicles as a real future, not a niche science project.",
      marketWeather: "High-growth innovation stocks can lead dramatically when risk appetite and narrative strength align.",
      moveDriver: "Brand, innovation, deliveries, software optionality, and investor imagination.",
      explanation: "Tesla shows both sides of the Monster framework: enormous upside potential and real volatility risk. The evidence has to keep improving or sentiment can turn viciously."
    },
    NFLX: {
      tippingPoint: "Streaming moved from experiment to dominant distribution model, and Netflix became the category reference point.",
      marketWeather: "Digital platforms with global reach attracted capital as consumers shifted away from old media habits.",
      moveDriver: "Global scale, engagement, pricing power, advertising optionality, and cash-flow improvement.",
      explanation: "Netflix's demonstration case shows how a category shift can create a Monster when the company becomes the default name in the new behavior."
    },
    AMD: {
      tippingPoint: "Execution improved, product credibility returned, and AMD became a real challenger again.",
      marketWeather: "Semiconductor leadership rewarded companies with credible roadmaps and data-center exposure.",
      moveDriver: "Product execution, data-center opportunity, AI exposure, and turnaround momentum.",
      explanation: "AMD is a turnaround Monster example. The key is not just being cheap or beaten down. The key is evidence that execution and market opportunity are both improving."
    },
    COST: {
      tippingPoint: "Membership economics and steady traffic showed that Costco could remain a quality compounder through different market conditions.",
      marketWeather: "Defensive growth and high-quality consumer businesses can lead when investors want durability.",
      moveDriver: "Membership renewal, customer loyalty, steady comparable sales, and operating discipline.",
      explanation: "Costco proves that Monsters do not have to be flashy. Durable economics, recurring behavior, and trust can create leadership without fireworks every quarter."
    },
    VRT: {
      tippingPoint: "AI data-center buildout created urgent demand for power and cooling infrastructure.",
      marketWeather: "AI infrastructure became one of the market's strongest leadership zones.",
      moveDriver: "Data-center demand, power systems, cooling exposure, backlog conversion, and thematic leadership.",
      explanation: "Vertiv is an example of finding the supplier behind the headline theme. The biggest Monster is not always the obvious brand. Sometimes it is the company solving the bottleneck."
    },
    AXON: {
      tippingPoint: "Axon expanded from hardware into a broader public-safety software and evidence ecosystem.",
      marketWeather: "Mission-critical technology platforms with recurring revenue attracted quality-growth investors.",
      moveDriver: "Recurring software, connected devices, retention, ecosystem expansion, and public-safety adoption.",
      explanation: "Axon shows why Monster DNA includes business model quality. Recurring revenue and ecosystem depth can make a growth story more durable."
    },
    DECK: {
      tippingPoint: "Brand momentum became measurable across categories while margins and distribution stayed disciplined.",
      marketWeather: "Selective consumer leaders could outperform when brand demand and execution separated them from weaker peers.",
      moveDriver: "Brand strength, margin performance, direct-to-consumer execution, and category expansion.",
      explanation: "Deckers is a brand-leadership case. The evidence is not just popularity. It is demand, pricing, margins, inventory discipline, and execution showing up together."
    },
    WING: {
      tippingPoint: "Unit growth and franchise economics showed that Wingstop could expand without carrying the full weight of traditional restaurant assets.",
      marketWeather: "Asset-light restaurant models could lead when growth remained visible and margins stayed attractive.",
      moveDriver: "Franchise expansion, same-store sales, brand awareness, digital mix, and unit economics.",
      explanation: "Wingstop is a smaller Monster lesson: repeatable unit economics can become a powerful evidence trail when expansion stays disciplined."
    },
    META: {
      tippingPoint: "Cost discipline, AI-driven ad efficiency, and cash flow repaired the story after a brutal reset.",
      marketWeather: "Mega-cap technology leadership returned as investors rewarded efficiency and durable cash generation.",
      moveDriver: "Advertising scale, engagement, AI efficiency, margins, and free cash flow.",
      explanation: "Meta is a recovery and re-acceleration case. A fallen leader can become interesting again when the evidence changes, not merely because the price went down."
    },
    APP: {
      tippingPoint: "Software growth and advertising optimization showed evidence of a stronger, higher-margin business model.",
      marketWeather: "The market rewarded companies showing real operating leverage and accelerating software economics.",
      moveDriver: "Ad technology, software revenue, margin expansion, market momentum, and product effectiveness.",
      explanation: "AppLovin shows why the system watches for sudden evidence alignment. When growth, margin improvement, and price strength arrive together, the stock earns closer study."
    },
    MSFT: {
      tippingPoint: "Cloud scale and AI integration strengthened Microsoft's already powerful enterprise platform.",
      marketWeather: "Mega-cap quality growth led as investors favored durable platforms with AI exposure and recurring revenue.",
      moveDriver: "Azure, enterprise distribution, recurring revenue, AI integration, and free cash flow.",
      explanation: "Microsoft is a platform Monster. Its advantage is not one product. It is distribution, recurring revenue, cloud scale, AI optionality, and cash generation reinforcing each other."
    }
  };

  function safe(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function launchTierClass(score) {
    if (score >= 90) return "platinum";
    if (score >= 75) return "gold";
    if (score >= 60) return "silver";
    if (score >= 45) return "bronze";
    return "goblin";
  }

  function chartUrl(ticker) {
    return `market-explorer.html?left=${encodeURIComponent(ticker)}&mode=single`;
  }

  function newsUrl(ticker) {
    return `news-radar.html?ticker=${encodeURIComponent(ticker)}`;
  }

  function injectLaunchStyles() {
    if (document.getElementById("monster-check-launch-result-styles")) return;
    const style = document.createElement("style");
    style.id = "monster-check-launch-result-styles";
    style.textContent = `
      .monster-launch-score-first {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(180px, 240px);
        gap: 22px;
        align-items: stretch;
        margin-bottom: 24px;
      }
      .monster-launch-summary {
        padding: 26px;
        border: 1px solid rgba(255,255,255,.16);
        background: linear-gradient(135deg, rgba(14,22,20,.96), rgba(25,35,31,.92));
      }
      .monster-launch-summary .monster-demo-flag {
        margin-bottom: 12px;
      }
      .monster-launch-summary h2 {
        margin: 0 0 12px;
        color: #fffaf0;
        font-size: clamp(34px, 4vw, 58px);
        line-height: .95;
        letter-spacing: -.045em;
      }
      .monster-launch-summary h2 span {
        color: var(--editorial-lime, #b8f34a);
      }
      .monster-launch-summary p {
        max-width: 850px;
        color: #e7e1d3;
        font-size: 16px;
        line-height: 1.55;
      }
      .monster-launch-score-card {
        display: grid;
        place-items: center;
        text-align: center;
        min-height: 235px;
        padding: 22px;
        border: 2px solid rgba(255,255,255,.18);
        background: #101514;
        box-shadow: 0 18px 44px rgba(0,0,0,.34);
      }
      .monster-launch-score-card span,
      .monster-launch-panel span,
      .monster-launch-action-bar span {
        color: #b8f34a;
        font-size: 10px;
        font-weight: 950;
        letter-spacing: .065em;
      }
      .monster-launch-score-card strong {
        display: block;
        color: #fffaf0;
        font-size: clamp(72px, 8vw, 112px);
        line-height: .82;
        letter-spacing: -.08em;
      }
      .monster-launch-score-card em {
        display: block;
        color: #f1c94a;
        font-size: 16px;
        font-style: normal;
        font-weight: 950;
        text-transform: uppercase;
      }
      .monster-launch-score-card.platinum { border-color: #d8e8f6; }
      .monster-launch-score-card.gold { border-color: #d9aa31; }
      .monster-launch-score-card.silver { border-color: #adb9be; }
      .monster-launch-evidence-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        margin: 20px 0;
      }
      .monster-launch-panel {
        min-height: 168px;
        padding: 20px;
        border: 1px solid rgba(255,255,255,.16);
        background: rgba(255,255,255,.045);
      }
      .monster-launch-panel h3 {
        margin: 8px 0 10px;
        color: #fffaf0;
        font-size: 18px;
        line-height: 1.05;
      }
      .monster-launch-panel p {
        margin: 0;
        color: #d4d9d1;
        font-size: 13px;
        line-height: 1.5;
      }
      .monster-launch-dna {
        margin: 24px 0;
        padding: 22px;
        border: 1px solid rgba(184,243,74,.24);
        background: rgba(184,243,74,.065);
      }
      .monster-launch-dna h3 {
        margin: 0 0 14px;
        color: #fffaf0;
        font-size: 24px;
      }
      .monster-launch-dna-list {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .monster-launch-dna-list .dna {
        display: inline-flex;
        align-items: center;
        min-height: 38px;
        padding: 0 14px;
        border: 1px solid rgba(184,243,74,.35);
        border-radius: 999px;
        background: #111715;
        color: #fffaf0;
        font-size: 12px;
        font-weight: 900;
      }
      .monster-launch-action-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        margin-top: 24px;
        padding: 20px;
        border: 1px solid rgba(255,255,255,.16);
        background: rgba(6,10,9,.78);
      }
      .monster-launch-action-bar > span {
        width: 100%;
      }
      .monster-launch-action-bar a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        padding: 0 18px;
        border: 1px solid rgba(255,255,255,.2);
        color: #fffaf0;
        font-size: 12px;
        font-weight: 950;
        letter-spacing: .035em;
        text-decoration: none;
      }
      .monster-launch-action-bar a:first-of-type {
        border-color: #b8f34a;
        background: #b8f34a;
        color: #0b100f;
      }
      .monster-launch-disclaimer {
        margin-top: 18px;
        padding: 16px 18px;
        border-left: 4px solid #d9aa31;
        background: rgba(217,170,49,.09);
        color: #d7dcd5;
        font-size: 12px;
        line-height: 1.55;
      }
      @media (max-width: 900px) {
        .monster-launch-score-first,
        .monster-launch-evidence-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.append(style);
  }

  window.renderStockResult = function renderLaunchStockResult(result, stock) {
    injectLaunchStyles();

    const ticker = String(stock.ticker || "").toUpperCase();
    const details = LAUNCH_DETAILS[ticker] || {
      tippingPoint: "The evidence began improving enough to deserve a deeper VCL™ review.",
      marketWeather: "Leadership can appear in any market when price strength and business evidence separate from the crowd.",
      moveDriver: stock.why || "Improving business evidence and price leadership.",
      explanation: stock.why || "The demonstration rating organizes the strongest available evidence without pretending to predict the future."
    };
    const tier = stock.tier || "Unrated";
    const score = Number.isFinite(Number(stock.score)) ? Number(stock.score) : "—";
    const cssTier = launchTierClass(Number(stock.score));
    const dna = Array.isArray(stock.dna)
      ? stock.dna.map((item) => `<span class="dna">${safe(item)}</span>`).join("")
      : "";

    result.style.display = "block";
    result.innerHTML = `
      <div class="monster-launch-score-first">
        <section class="monster-launch-summary">
          <p class="monster-demo-flag">15-STOCK VCL™ DEMONSTRATION · EDUCATIONAL RATING</p>
          <h2><span>$${safe(ticker)}</span><br>${safe(stock.name)}</h2>
          <p>${safe(details.explanation)}</p>
          <p><strong>Short read:</strong> ${safe(stock.why)}</p>
        </section>
        <aside class="monster-launch-score-card ${safe(cssTier)}" aria-label="Demonstration Monster Rating ${safe(score)} out of 100, ${safe(tier)}">
          <div>
            <span>MONSTER RATING™</span>
            <strong>${safe(score)}</strong>
            <em>${safe(tier)}</em>
          </div>
        </aside>
      </div>

      <section class="monster-launch-dna">
        <span class="monster-section-label">01 / MONSTER DNA™</span>
        <h3>WHAT IS SHOWING UP</h3>
        <div class="monster-launch-dna-list">${dna}</div>
      </section>

      <div class="monster-launch-evidence-grid">
        <section class="monster-launch-panel">
          <span>02 / TIPPING POINT™</span>
          <h3>WHAT CHANGED</h3>
          <p>${safe(details.tippingPoint)}</p>
        </section>
        <section class="monster-launch-panel">
          <span>03 / MARKET WEATHER™</span>
          <h3>THE BACKDROP</h3>
          <p>${safe(details.marketWeather)}</p>
        </section>
        <section class="monster-launch-panel">
          <span>04 / MOVE DRIVER™</span>
          <h3>WHAT MOVED IT</h3>
          <p>${safe(details.moveDriver)}</p>
        </section>
      </div>

      <div class="monster-launch-evidence-grid">
        <section class="monster-launch-panel">
          <span>05 / RISK</span>
          <h3>WHAT CAN BREAK THE SETUP</h3>
          <p>${safe(stock.warning)}</p>
        </section>
        <section class="monster-launch-panel">
          <span>06 / WHAT TO WATCH</span>
          <h3>NEXT EVIDENCE CHECK</h3>
          <p>${safe((window.DEMO_OUTLOOK && window.DEMO_OUTLOOK[ticker]?.watch) || "Watch future filings, price action, leadership, margins, and whether the business keeps confirming the setup.")}</p>
        </section>
        <section class="monster-launch-panel">
          <span>07 / VCL™ PRINCIPLE</span>
          <h3>THE LESSON</h3>
          <p>The screen does not find guaranteed winners. It finds evidence. This demonstration shows how one past or current leader can be studied through repeatable categories.</p>
        </section>
      </div>

      <div class="monster-launch-action-bar">
        <span>OPEN THE EVIDENCE</span>
        <a href="${safe(chartUrl(ticker))}">OPEN FULL CHART →</a>
        <a href="${safe(newsUrl(ticker))}">OPEN NEWS / FILINGS →</a>
      </div>

      <div class="monster-launch-disclaimer">
        <strong>Educational disclaimer:</strong> This Monster Rating™ is a launch demonstration for the original 15 VCL™ stocks. It is not a buy, sell, or hold recommendation, not current financial advice, and not a guarantee of future performance. Market conditions, prices, company results, and verified news can change. Investing involves risk, including loss of principal.
      </div>`;
  };
})();
