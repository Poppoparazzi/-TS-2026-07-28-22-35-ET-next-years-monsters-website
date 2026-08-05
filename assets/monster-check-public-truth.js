// TS: 2026-08-05 11:46 ET
(() => {
  const result = document.querySelector('[data-result]');
  if (!result) return;

  const installPresentationStyles = () => {
    if (document.getElementById('monster-check-presentation-fix')) return;

    const style = document.createElement('style');
    style.id = 'monster-check-presentation-fix';
    style.textContent = `
      .monster-launch-dna {
        background: #17211e !important;
        border-color: rgba(184, 243, 74, .52) !important;
      }

      .monster-launch-panel {
        background: #17211e !important;
        border-color: rgba(255, 255, 255, .28) !important;
      }

      .monster-launch-dna h3,
      .monster-launch-panel h3 {
        color: #fffaf0 !important;
      }

      .monster-launch-panel p {
        color: #e4e8e1 !important;
      }

      .monster-launch-disclaimer {
        background: #2a2416 !important;
        color: #f1ede2 !important;
      }

      .monster-result.monster-launch-captain-layout {
        display: grid !important;
        grid-template-columns: minmax(300px, .5fr) minmax(0, 1fr);
        align-items: stretch;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, .16);
        background: #0b100f;
        box-shadow: 0 24px 70px rgba(0, 0, 0, .24);
      }

      .monster-launch-captain {
        position: relative;
        min-height: 100%;
        overflow: hidden;
        border-right: 1px solid rgba(255, 255, 255, .14);
        background:
          radial-gradient(circle at 50% 27%, rgba(184, 243, 74, .19), transparent 31%),
          linear-gradient(155deg, #111a17 0%, #070b0a 72%);
      }

      .monster-launch-captain::before {
        position: absolute;
        inset: 8% -16% auto;
        height: 48%;
        content: '';
        opacity: .16;
        background:
          repeating-radial-gradient(ellipse at center, rgba(184, 243, 74, .78) 0 2px, transparent 3px 8px),
          radial-gradient(ellipse at center, transparent 0 42%, rgba(184, 243, 74, .32) 43%, transparent 58%);
        border-radius: 50%;
        transform: rotate(-9deg);
      }

      .monster-launch-captain-stage {
        position: absolute;
        inset: 88px 0 42px;
        z-index: 2;
      }

      .monster-launch-captain-stage img {
        position: absolute;
        right: -6%;
        bottom: 0;
        left: -6%;
        width: 112%;
        height: 100%;
        object-fit: contain;
        object-position: center bottom;
        filter: drop-shadow(0 24px 34px rgba(0, 0, 0, .58));
      }

      .monster-launch-magnifier {
        position: absolute;
        right: 6%;
        bottom: 33%;
        z-index: 4;
        width: 104px;
        aspect-ratio: 1;
        border: 8px solid #f4c84d;
        border-radius: 50%;
        background:
          radial-gradient(circle at 35% 30%, rgba(255, 255, 255, .72), transparent 18%),
          linear-gradient(145deg, rgba(184, 243, 74, .26), rgba(5, 14, 12, .88));
        box-shadow:
          0 0 0 2px rgba(0, 0, 0, .72),
          0 20px 26px rgba(0, 0, 0, .46);
      }

      .monster-launch-magnifier::before {
        position: absolute;
        inset: 18px;
        content: '';
        border-radius: 50%;
        background:
          repeating-radial-gradient(ellipse at center, rgba(255, 250, 240, .92) 0 2px, transparent 3px 7px),
          radial-gradient(ellipse at center, transparent 0 32%, rgba(255, 250, 240, .72) 33%, transparent 48%, rgba(255, 250, 240, .58) 49%, transparent 64%);
        transform: rotate(-18deg) scaleX(.72);
      }

      .monster-launch-magnifier::after {
        position: absolute;
        right: -37px;
        bottom: -24px;
        width: 56px;
        height: 12px;
        content: '';
        border-radius: 999px;
        background: #f4c84d;
        box-shadow: 0 0 0 2px rgba(0, 0, 0, .7);
        transform: rotate(42deg);
        transform-origin: left center;
      }

      .monster-launch-evidence-pointer {
        position: absolute;
        top: 46%;
        right: 0;
        z-index: 5;
        width: 31%;
        height: 3px;
        background: linear-gradient(90deg, rgba(244, 200, 77, 0), #f4c84d 36%, #b8f34a);
        filter: drop-shadow(0 0 10px rgba(184, 243, 74, .42));
      }

      .monster-launch-evidence-pointer::after {
        position: absolute;
        top: -7px;
        right: -2px;
        content: '';
        border-top: 8px solid transparent;
        border-bottom: 8px solid transparent;
        border-left: 13px solid #b8f34a;
      }

      .monster-launch-captain-label {
        position: absolute;
        top: 24px;
        right: 24px;
        left: 24px;
        z-index: 6;
      }

      .monster-launch-captain-label strong {
        display: block;
        color: #b8f34a;
        font-family: Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
        font-size: clamp(30px, 48px, 50px);
        letter-spacing: 0;
        line-height: .9;
      }

      .monster-launch-captain-label span {
        display: block;
        margin-top: 10px;
        color: #fffaf0;
        font-size: 10px;
        font-weight: 950;
        letter-spacing: .09em;
      }

      .monster-launch-captain-caption {
        position: absolute;
        right: 22px;
        bottom: 18px;
        left: 22px;
        z-index: 6;
        margin: 0;
        padding-top: 12px;
        border-top: 1px solid rgba(184, 243, 74, .45);
        color: #dfe5dc;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .045em;
        line-height: 1.45;
      }

      .monster-launch-content {
        min-width: 0;
        padding: 24px;
        background: #0b100f;
      }

      @media (max-width: 900px) {
        .monster-result.monster-launch-captain-layout {
          grid-template-columns: 1fr;
        }

        .monster-launch-captain {
          min-height: 390px;
          border-right: 0;
          border-bottom: 1px solid rgba(255, 255, 255, .14);
        }

        .monster-launch-captain-stage {
          inset: 48px 0 30px;
        }

        .monster-launch-captain-stage img {
          right: 6%;
          left: auto;
          width: min(58%, 360px);
          height: 86%;
        }

        .monster-launch-magnifier {
          right: 12%;
          bottom: 28%;
          width: 88px;
          border-width: 7px;
        }

        .monster-launch-evidence-pointer {
          top: 50%;
          width: 23%;
        }

        .monster-launch-captain-label {
          right: 46%;
        }

        .monster-launch-dna,
        .monster-launch-panel,
        .monster-launch-disclaimer {
          color: #fffaf0;
        }
      }

      @media (max-width: 560px) {
        .monster-launch-captain {
          min-height: 320px;
        }

        .monster-launch-captain-stage img {
          right: -3%;
          width: 68%;
        }

        .monster-launch-magnifier {
          right: 11%;
          bottom: 29%;
          width: 72px;
          border-width: 6px;
        }

        .monster-launch-magnifier::after {
          right: -30px;
          bottom: -20px;
          width: 45px;
          height: 10px;
        }

        .monster-launch-evidence-pointer {
          top: 54%;
          width: 20%;
        }

        .monster-launch-captain-label {
          right: 42%;
          top: 20px;
          left: 20px;
        }

        .monster-launch-captain-label strong {
          font-size: 30px;
        }

        .monster-launch-content {
          padding: 14px;
        }
      }
    `;
    document.head.append(style);
  };

  const installCaptainLayout = () => {
    const hasCaptain = result.querySelector(':scope > .monster-launch-captain');
    const hasContent = result.querySelector(':scope > .monster-launch-content');
    if (hasCaptain && hasContent) return;
    if (!result.firstElementChild) return;

    result.classList.remove('monster-launch-captain-layout');

    const content = document.createElement('div');
    content.className = 'monster-launch-content';
    while (result.firstChild) content.append(result.firstChild);

    const captain = document.createElement('aside');
    captain.className = 'monster-launch-captain';
    captain.setAttribute(
      'aria-label',
      'Captain Breakout investigates the company evidence with a fingerprint magnifying glass',
    );
    captain.innerHTML = `
      <div class="monster-launch-captain-label">
        <strong>CAPTAIN<br>BREAKOUT™</strong>
        <span>INVESTIGATOR MODE</span>
      </div>
      <div class="monster-launch-captain-stage" aria-hidden="true">
        <img src="captain_breakout.png" alt="">
        <span class="monster-launch-magnifier"></span>
        <span class="monster-launch-evidence-pointer"></span>
      </div>
      <p class="monster-launch-captain-caption">THE SCREEN DOES NOT FIND GUARANTEED WINNERS. IT FINDS EVIDENCE.</p>
    `;

    result.classList.add('monster-launch-captain-layout');
    result.append(captain, content);
  };

  const standardizeResult = () => {
    const newsPlaceholder = result.querySelector('.monster-news-section');
    if (newsPlaceholder) newsPlaceholder.remove();

    result.querySelectorAll('.monster-demo-flag').forEach((label) => {
      const text = label.textContent.trim().toUpperCase();
      if (text.includes('DEMONSTRATION RATING')) {
        label.textContent = 'DEMONSTRATION RATING · NOT LIVE DATA';
      } else if (text.includes('OFFICIAL SEC COMPANY RECORD')) {
        label.textContent = 'OFFICIAL SEC EVIDENCE · NOT YET RATED';
      } else if (text.includes('SEC SERVICE TEMPORARILY UNAVAILABLE')) {
        label.textContent = 'PROVIDER NOT CONNECTED';
      } else if (text.includes('NO SEC COMPANY MATCH FOUND')) {
        label.textContent = 'UNRESOLVED SEC IDENTITY';
      }
    });

    installCaptainLayout();
  };

  installPresentationStyles();
  new MutationObserver(standardizeResult).observe(result, {
    childList: true,
    subtree: true,
  });
  standardizeResult();
})();
