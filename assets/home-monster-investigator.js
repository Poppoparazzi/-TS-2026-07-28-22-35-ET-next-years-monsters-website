// TS: 2026-08-05 12:00 ET

(function installHomeMonsterInvestigator() {
  "use strict";

  const section = document.querySelector(".home-check#monster-check");
  const heading = section?.querySelector(".home-check-heading");
  if (!section || !heading || heading.dataset.investigatorInstalled === "true") return;

  heading.dataset.investigatorInstalled = "true";
  section.classList.add("home-check-investigator-ready");

  const style = document.createElement("style");
  style.id = "home-monster-investigator-styles";
  style.textContent = `
    .home-check-investigator-ready .home-check-heading {
      position: relative;
      min-height: 720px;
      overflow: hidden;
      padding: 0;
      border-right: 1px solid rgba(255, 255, 255, .14);
      background:
        radial-gradient(circle at 52% 30%, rgba(184, 243, 74, .2), transparent 31%),
        linear-gradient(155deg, #111a17 0%, #070b0a 74%);
    }

    .home-investigator-panel {
      position: absolute;
      inset: 0;
      overflow: hidden;
      color: #fffaf0;
    }

    .home-investigator-panel::before {
      position: absolute;
      inset: 8% -18% auto;
      height: 48%;
      content: "";
      opacity: .14;
      border-radius: 50%;
      background:
        repeating-radial-gradient(ellipse at center, rgba(184, 243, 74, .8) 0 2px, transparent 3px 9px),
        radial-gradient(ellipse at center, transparent 0 42%, rgba(184, 243, 74, .32) 43%, transparent 58%);
      transform: rotate(-10deg);
    }

    .home-investigator-label {
      position: absolute;
      top: 34px;
      right: 32px;
      left: 32px;
      z-index: 6;
    }

    .home-investigator-label span {
      display: block;
      margin-bottom: 10px;
      color: #f4c84d;
      font-size: 11px;
      font-weight: 950;
      letter-spacing: .1em;
    }

    .home-investigator-label h2 {
      margin: 0;
      color: #b8f34a;
      font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
      font-size: clamp(46px, 5vw, 76px);
      letter-spacing: 0;
      line-height: .86;
    }

    .home-investigator-stage {
      position: absolute;
      inset: 128px 0 64px;
      z-index: 2;
    }

    .home-investigator-stage img {
      position: absolute;
      right: -7%;
      bottom: 0;
      left: -7%;
      width: 114%;
      height: 100%;
      object-fit: contain;
      object-position: center bottom;
      filter: drop-shadow(0 26px 36px rgba(0, 0, 0, .62));
    }

    .home-investigator-magnifier {
      position: absolute;
      right: 5%;
      bottom: 31%;
      z-index: 5;
      width: 112px;
      aspect-ratio: 1;
      border: 8px solid #f4c84d;
      border-radius: 50%;
      background:
        radial-gradient(circle at 34% 28%, rgba(255, 255, 255, .72), transparent 18%),
        linear-gradient(145deg, rgba(184, 243, 74, .3), rgba(5, 14, 12, .9));
      box-shadow: 0 0 0 2px rgba(0, 0, 0, .75), 0 20px 28px rgba(0, 0, 0, .5);
    }

    .home-investigator-magnifier::before {
      position: absolute;
      inset: 18px;
      content: "";
      border-radius: 50%;
      background:
        repeating-radial-gradient(ellipse at center, rgba(255, 250, 240, .94) 0 2px, transparent 3px 7px),
        radial-gradient(ellipse at center, transparent 0 31%, rgba(255, 250, 240, .72) 32%, transparent 48%, rgba(255, 250, 240, .58) 49%, transparent 64%);
      transform: rotate(-18deg) scaleX(.72);
    }

    .home-investigator-magnifier::after {
      position: absolute;
      right: -40px;
      bottom: -25px;
      width: 60px;
      height: 13px;
      content: "";
      border-radius: 999px;
      background: #f4c84d;
      box-shadow: 0 0 0 2px rgba(0, 0, 0, .72);
      transform: rotate(42deg);
      transform-origin: left center;
    }

    .home-investigator-pointer {
      position: absolute;
      top: 48%;
      right: 0;
      z-index: 5;
      width: 32%;
      height: 3px;
      background: linear-gradient(90deg, rgba(244, 200, 77, 0), #f4c84d 34%, #b8f34a);
      filter: drop-shadow(0 0 10px rgba(184, 243, 74, .44));
    }

    .home-investigator-pointer::after {
      position: absolute;
      top: -7px;
      right: -2px;
      content: "";
      border-top: 8px solid transparent;
      border-bottom: 8px solid transparent;
      border-left: 13px solid #b8f34a;
    }

    .home-investigator-caption {
      position: absolute;
      right: 28px;
      bottom: 22px;
      left: 28px;
      z-index: 6;
      margin: 0;
      padding-top: 13px;
      border-top: 1px solid rgba(184, 243, 74, .46);
      color: #dfe5dc;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: .04em;
      line-height: 1.45;
    }

    @media (max-width: 900px) {
      .home-check-investigator-ready .home-check-heading {
        min-height: 440px;
        border-right: 0;
        border-bottom: 1px solid rgba(255, 255, 255, .14);
      }

      .home-investigator-stage {
        inset: 72px 0 42px;
      }

      .home-investigator-stage img {
        right: 5%;
        left: auto;
        width: min(58%, 390px);
        height: 90%;
      }

      .home-investigator-label {
        right: 46%;
      }

      .home-investigator-magnifier {
        right: 12%;
        bottom: 28%;
        width: 90px;
        border-width: 7px;
      }

      .home-investigator-pointer {
        width: 23%;
      }
    }

    @media (max-width: 560px) {
      .home-check-investigator-ready .home-check-heading {
        min-height: 350px;
      }

      .home-investigator-label {
        top: 24px;
        right: 42%;
        left: 20px;
      }

      .home-investigator-label h2 {
        font-size: 38px;
      }

      .home-investigator-stage img {
        right: -4%;
        width: 70%;
      }

      .home-investigator-magnifier {
        right: 10%;
        bottom: 29%;
        width: 72px;
        border-width: 6px;
      }

      .home-investigator-magnifier::after {
        right: -30px;
        bottom: -20px;
        width: 46px;
        height: 10px;
      }

      .home-investigator-caption {
        right: 20px;
        left: 20px;
      }
    }
  `;
  document.head.append(style);

  heading.innerHTML = `
    <aside class="home-investigator-panel" aria-label="Captain Breakout investigates the company evidence with a fingerprint magnifying glass">
      <div class="home-investigator-label">
        <span>00 / MONSTER CHECK™</span>
        <h2 id="check-title">CAPTAIN<br>BREAKOUT™</h2>
      </div>
      <div class="home-investigator-stage" aria-hidden="true">
        <img src="captain_breakout.png" alt="">
        <span class="home-investigator-magnifier"></span>
        <span class="home-investigator-pointer"></span>
      </div>
      <p class="home-investigator-caption">THE SCREEN DOES NOT FIND GUARANTEED WINNERS. IT FINDS EVIDENCE.</p>
    </aside>
  `;
})();
