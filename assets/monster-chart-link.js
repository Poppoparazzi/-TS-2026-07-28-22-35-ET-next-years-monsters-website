// TS: 2026-08-05 18:52 ET

function normalizeMonsterTicker(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

function addMonsterResultChartLink() {
  const result = document.querySelector("[data-result]");
  const identity = result?.querySelector(".monster-result-identity");
  const tickerNode = identity?.querySelector("h2 span");
  if (!identity || !tickerNode) return;

  const ticker = normalizeMonsterTicker(tickerNode.textContent);
  if (!ticker) return;

  let link = identity.querySelector("[data-monster-result-chart-link]");
  if (!link) {
    link = document.createElement("a");
    link.className = "home-btn home-btn-black monster-result-chart-link";
    link.dataset.monsterResultChartLink = "";
    identity.append(link);
  }

  link.href = `market-explorer.html?left=${encodeURIComponent(ticker)}&mode=single`;
  link.textContent = `OPEN ${ticker} FULL CHART →`;
  link.setAttribute("aria-label", `Open ${ticker} in the full single-chart view`);
}

function pairMonsterShortcutCharts() {
  const suggestions = document.querySelector("[data-suggestions]");
  if (!suggestions) return;

  const buttons = suggestions.querySelectorAll(
    ":scope > button.chip:not([data-monster-shortcut-paired])",
  );

  buttons.forEach((button) => {
    const ticker = normalizeMonsterTicker(button.textContent);
    if (!ticker) return;

    button.dataset.monsterShortcutPaired = "";
    button.classList.add("monster-shortcut-check");
    button.textContent = ticker;
    button.title = `Run the ${ticker} Monster Check`;
    button.setAttribute("aria-label", `Run Monster Check for ${ticker}`);

    const wrapper = document.createElement("span");
    wrapper.className = "monster-stock-shortcut";

    const chartLink = document.createElement("a");
    chartLink.className = "monster-shortcut-chart";
    chartLink.href = `market-explorer.html?left=${encodeURIComponent(ticker)}&mode=single`;
    chartLink.textContent = "CHART";
    chartLink.title = `Open ${ticker} full chart`;
    chartLink.setAttribute("aria-label", `Open ${ticker} full chart`);

    wrapper.append(button, chartLink);
    suggestions.append(wrapper);
  });
}

function installInvestigatorStyles() {
  if (document.getElementById("monster-investigator-result-styles")) return;

  const style = document.createElement("style");
  style.id = "monster-investigator-result-styles";
  style.textContent = `
    .monster-investigator-door {
      display: inline-flex;
      min-height: 48px;
      margin-top: 24px;
      padding: 0 19px;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--editorial-gold, #d9a825);
      color: #fffaf0;
      font-size: 11px;
      font-weight: 950;
      letter-spacing: .04em;
      text-decoration: none;
    }

    .monster-investigator-door:hover,
    .monster-investigator-door:focus-visible {
      border-color: var(--editorial-lime, #a8df34);
      outline: 3px solid var(--editorial-red, #ed3327);
      outline-offset: 3px;
    }

    .monster-result.monster-investigator-result {
      display: grid !important;
      grid-template-columns: minmax(340px, 38%) minmax(0, 62%);
      align-items: stretch;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,.18);
      background: #07100f;
      box-shadow: 0 24px 70px rgba(0,0,0,.25);
    }

    .monster-investigator-result-art {
      position: relative;
      min-height: 760px;
      overflow: hidden;
      border-right: 1px solid rgba(255,255,255,.18);
      background:
        radial-gradient(circle at 53% 34%, rgba(168,223,52,.16), transparent 36%),
        linear-gradient(155deg, #111a17 0%, #050908 75%);
    }

    .monster-investigator-result-art img {
      position: absolute;
      inset: 20px 0 0;
      width: 100%;
      height: calc(100% - 20px);
      max-width: none;
      object-fit: contain;
      object-position: center bottom;
      filter: drop-shadow(0 28px 40px rgba(0,0,0,.62));
    }

    .monster-investigator-result-label {
      position: absolute;
      top: 24px;
      left: 24px;
      z-index: 4;
      margin: 0;
      color: var(--editorial-lime, #a8df34);
      font-size: 12px;
      font-weight: 950;
      letter-spacing: .08em;
    }

    .monster-investigator-result-status {
      position: absolute;
      right: 18px;
      bottom: 18px;
      left: 18px;
      z-index: 5;
      margin: 0;
      padding: 15px 16px;
      border: 1px solid rgba(168,223,52,.58);
      background: rgba(5,9,8,.91);
      color: #fffaf0;
      font-size: 12px;
      font-weight: 850;
      line-height: 1.45;
    }

    .monster-investigator-result-status strong {
      display: block;
      margin-bottom: 4px;
      color: var(--editorial-lime, #a8df34);
      font-size: 14px;
      font-weight: 950;
    }

    .monster-investigator-result-arrow {
      position: absolute;
      top: 35%;
      right: 0;
      z-index: 6;
      width: 31%;
      height: 3px;
      background: linear-gradient(90deg, transparent, #d9a825 45%, #a8df34);
      filter: drop-shadow(0 0 8px rgba(168,223,52,.55));
    }

    .monster-investigator-result-arrow::after {
      position: absolute;
      top: -7px;
      right: 0;
      width: 0;
      height: 0;
      content: "";
      border-top: 8px solid transparent;
      border-bottom: 8px solid transparent;
      border-left: 14px solid #a8df34;
    }

    .monster-investigator-result-content {
      min-width: 0;
      padding: 28px;
      background: #0b100f;
      color: #fffaf0;
    }

    .monster-investigator-result-content > :first-child {
      margin-top: 0;
    }

    @media (max-width: 980px) {
      .monster-result.monster-investigator-result {
        grid-template-columns: 1fr;
      }

      .monster-investigator-result-art {
        min-height: 610px;
        border-right: 0;
        border-bottom: 1px solid rgba(255,255,255,.18);
      }

      .monster-investigator-result-arrow {
        top: auto;
        right: 8%;
        bottom: 0;
        width: 3px;
        height: 22%;
        background: linear-gradient(180deg, transparent, #d9a825 45%, #a8df34);
      }

      .monster-investigator-result-arrow::after {
        top: auto;
        right: -7px;
        bottom: 0;
        border-top: 14px solid #a8df34;
        border-right: 8px solid transparent;
        border-bottom: 0;
        border-left: 8px solid transparent;
      }
    }

    @media (max-width: 620px) {
      .monster-investigator-result-art {
        min-height: 500px;
      }

      .monster-investigator-result-content {
        padding: 16px;
      }

      .monster-investigator-result-status {
        right: 12px;
        bottom: 12px;
        left: 12px;
      }
    }
  `;
  document.head.append(style);
}

function getInvestigatorResultState(result) {
  const score = result.querySelector(
    ".monster-launch-score-card strong, .score-badge strong, [data-monster-score]",
  )?.textContent?.trim();

  const tier = result.querySelector(
    ".monster-launch-score-card em, .score-badge small, [data-monster-tier]",
  )?.textContent?.trim();

  if (score && score !== "—") {
    return {
      key: `score-${score}-${tier || ""}`,
      heading: `MONSTER RATING™ ${score}`,
      message: tier
        ? `${tier}. CB points toward the rating while the evidence explains the result.`
        : "CB points toward the rating while the evidence explains the result.",
    };
  }

  const fullText = result.textContent.toUpperCase();
  let heading = "EVIDENCE STATUS";

  if (fullText.includes("PROVIDER NOT CONNECTED")) {
    heading = "PROVIDER NOT CONNECTED";
  } else if (fullText.includes("UNRESOLVED SEC IDENTITY")) {
    heading = "UNRESOLVED SEC IDENTITY";
  } else if (fullText.includes("NOT YET RATED")) {
    heading = "NOT YET RATED";
  } else if (fullText.includes("OFFICIAL SEC EVIDENCE")) {
    heading = "OFFICIAL SEC EVIDENCE";
  } else if (fullText.includes("DEMONSTRATION")) {
    heading = "DEMONSTRATION RATING";
  }

  return {
    key: `status-${heading}`,
    heading,
    message: "CB points toward the truthful evidence status. No missing rating is invented.",
  };
}

function installInvestigatorDoor() {
  const heroCopy = document.querySelector(".monster-hero-copy");
  if (!heroCopy || heroCopy.querySelector(".monster-investigator-door")) return;

  const link = document.createElement("a");
  link.className = "monster-investigator-door";
  link.href = "captain-breakout-investigator.html";
  link.textContent = "MEET CB THE INVESTIGATOR →";
  heroCopy.append(link);
}

function installInvestigatorResult() {
  const result = document.querySelector("[data-result]");
  if (!result) return;

  const existingArt = result.querySelector(":scope > .monster-investigator-result-art");
  const existingContent = result.querySelector(":scope > .monster-investigator-result-content");

  if (existingArt && existingContent) {
    const state = getInvestigatorResultState(existingContent);
    const status = existingArt.querySelector(".monster-investigator-result-status");
    if (status && status.dataset.stateKey !== state.key) {
      status.dataset.stateKey = state.key;
      status.innerHTML = `<strong>${state.heading}</strong>${state.message}`;
    }
    return;
  }

  if (!result.firstElementChild || getComputedStyle(result).display === "none") {
    result.classList.remove("monster-investigator-result");
    return;
  }

  const content = document.createElement("div");
  content.className = "monster-investigator-result-content";
  while (result.firstChild) content.append(result.firstChild);

  const state = getInvestigatorResultState(content);
  const art = document.createElement("aside");
  art.className = "monster-investigator-result-art";
  art.setAttribute(
    "aria-label",
    "CB the Investigator points toward the selected company rating or evidence status",
  );
  art.innerHTML = `
    <p class="monster-investigator-result-label">CB THE INVESTIGATOR™</p>
    <img src="assets/captain-breakout-investigator.webp" alt="CB the Investigator holding a fingerprint magnifying glass and pointing toward the selected stock evidence">
    <span class="monster-investigator-result-arrow" aria-hidden="true"></span>
    <p class="monster-investigator-result-status" data-state-key="${state.key}"><strong>${state.heading}</strong>${state.message}</p>
  `;

  result.classList.add("monster-investigator-result");
  result.append(art, content);
}

function startMonsterChartLinks() {
  const result = document.querySelector("[data-result]");
  const suggestions = document.querySelector("[data-suggestions]");

  installInvestigatorStyles();
  installInvestigatorDoor();
  addMonsterResultChartLink();
  pairMonsterShortcutCharts();
  installInvestigatorResult();

  if (result) {
    let resultFrame = 0;
    const resultObserver = new MutationObserver(() => {
      window.cancelAnimationFrame(resultFrame);
      resultFrame = window.requestAnimationFrame(() => {
        addMonsterResultChartLink();
        installInvestigatorResult();
      });
    });

    resultObserver.observe(result, {
      childList: true,
      subtree: true,
    });
  }

  if (suggestions) {
    const suggestionObserver = new MutationObserver(() => {
      window.requestAnimationFrame(pairMonsterShortcutCharts);
    });

    suggestionObserver.observe(suggestions, {
      childList: true,
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startMonsterChartLinks);
} else {
  startMonsterChartLinks();
}
