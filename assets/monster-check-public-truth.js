// TS: 2026-08-05 07:33 ET
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
        grid-template-columns: minmax(300px, .42fr) minmax(0, 1fr);
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
        inset: 7% -14% auto;
        height: 48%;
        content: '';
        opacity: .18;
        background: url('monster-fingerprint-green-blue.png') center / contain no-repeat;
        transform: rotate(-9deg);
      }

      .monster-launch-captain img {
        position: absolute;
        right: -6%;
        bottom: 32px;
        left: -6%;
        z-index: 2;
        width: 112%;
        height: calc(100% - 92px);
        object-fit: contain;
        object-position: center bottom;
        filter: drop-shadow(0 24px 34px rgba(0, 0, 0, .58));
      }

      .monster-launch-captain-label {
        position: absolute;
        top: 24px;
        right: 24px;
        left: 24px;
        z-index: 3;
      }

      .monster-launch-captain-label strong {
        display: block;
        color: #b8f34a;
        font-family: Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif;
        font-size: clamp(30px, 3vw, 50px);
        letter-spacing: -.025em;
        line-height: .88;
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
        z-index: 3;
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

        .monster-launch-captain img {
          right: 6%;
          left: auto;
          width: min(58%, 360px);
          height: 86%;
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

        .monster-launch-captain img {
          right: -3%;
          width: 68%;
        }

        .monster-launch-captain-label {
          right: 42%;
          top: 20px;
          left: 20px;
        }

        .monster-launch-content {
          padding: 14px;
        }
      }
    `;
    document.head.append(style);
  };

  const installCaptainLayout = () => {
    if (!result.firstElementChild || result.classList.contains('monster-launch-captain-layout')) return;

    const content = document.createElement('div');
    content.className = 'monster-launch-content';
    while (result.firstChild) content.append(result.firstChild);

    const captain = document.createElement('aside');
    captain.className = 'monster-launch-captain';
    captain.setAttribute('aria-label', 'Captain Breakout evidence guide');
    captain.innerHTML = `
      <div class="monster-launch-captain-label">
        <strong>CAPTAIN<br>BREAKOUT™</strong>
        <span>EVIDENCE GUIDE</span>
      </div>
      <img src="captain_breakout.png" alt="Approved full-color Captain Breakout">
      <p class="monster-launch-captain-caption">FOLLOW THE EVIDENCE. QUESTION THE EXCITEMENT.</p>
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
