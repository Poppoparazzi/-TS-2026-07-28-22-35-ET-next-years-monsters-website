// TS: 2026-08-05 14:31 ET
(() => {
  const result = document.querySelector('[data-result]');
  if (!result) return;

  let applying = false;

  const installPresentationStyles = () => {
    if (document.getElementById('monster-check-investigator-result-styles')) return;

    const style = document.createElement('style');
    style.id = 'monster-check-investigator-result-styles';
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

      .monster-investigator-door {
        display: inline-flex;
        min-height: 48px;
        margin-top: 22px;
        padding: 0 19px;
        align-items: center;
        justify-content: center;
        border: 2px solid #dda929;
        color: #fffaf0;
        font-size: 11px;
        font-weight: 950;
        text-decoration: none;
      }

      .monster-investigator-door:hover,
      .monster-investigator-door:focus-visible {
        outline: 3px solid #ef3528;
        outline-offset: 3px;
      }

      .monster-result.monster-investigator-layout {
        display: grid !important;
        grid-template-columns: minmax(330px, 36%) minmax(0, 1fr);
        align-items: stretch;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, .17);
        background: #0a0f0d;
        box-shadow: 0 24px 70px rgba(0, 0, 0, .28);
      }

      .monster-investigator-panel {
        position: relative;
        min-height: 610px;
        overflow: hidden;
        border-right: 1px solid rgba(255, 255, 255, .16);
        background: #040807;
      }

      .monster-investigator-panel img {
        position: absolute;
        inset: 0 auto 0 0;
        width: 100%;
        height: 100%;
        max-width: none;
        object-fit: cover;
        object-position: left center;
      }

      .monster-investigator-panel::after {
        position: absolute;
        top: 37%;
        right: -1px;
        z-index: 3;
        width: 33%;
        height: 3px;
        content: "";
        background: linear-gradient(90deg, rgba(244, 200, 77, 0), #f4c84d 46%, #b8f34a);
        filter: drop-shadow(0 0 9px rgba(184, 243, 74, .52));
      }

      .monster-investigator-arrow {
        position: absolute;
        top: calc(37% - 7px);
        right: -1px;
        z-index: 4;
        width: 0;
        height: 0;
        border-top: 8px solid transparent;
        border-bottom: 8px solid transparent;
        border-left: 14px solid #b8f34a;
      }

      .monster-investigator-status {
        position: absolute;
        right: 18px;
        bottom: 18px;
        left: 18px;
        z-index: 5;
        margin: 0;
        padding: 14px 15px;
        border: 1px solid rgba(184, 243, 74, .5);
        background: rgba(4, 8, 7, .88);
        color: #fffaf0;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .035em;
        line-height: 1.45;
      }

      .monster-investigator-status strong {
        display: block;
        margin-bottom: 5px;
        color: #b8f34a;
        font-size: 12px;
      }

      .monster-investigator-content {
        min-width: 0;
        padding: 24px;
        background: #0a0f0d;
      }

      @media (max-width: 980px) {
        .monster-result.monster-investigator-layout {
          grid-template-columns: 1fr;
        }

        .monster-investigator-panel {
          min-height: 470px;
          border-right: 0;
          border-bottom: 1px solid rgba(255, 255, 255, .16);
        }

        .monster-investigator-panel img {
          width: 100%;
          height: 100%;
          object-position: left 22%;
        }

        .monster-investigator-panel::after {
          top: 46%;
          width: 24%;
        }

        .monster-investigator-arrow {
          top: calc(46% - 7px);
        }
      }

      @media (max-width: 620px) {
        .monster-investigator-panel {
          min-height: 390px;
        }

        .monster-investigator-panel img {
          width: 158%;
          object-position: left top;
        }

        .monster-investigator-content {
          padding: 14px;
        }

        .monster-investigator-status {
          right: 12px;
          bottom: 12px;
          left: 12px;
        }

        .monster-launch-dna,
        .monster-launch-panel,
        .monster-launch-disclaimer {
          color: #fffaf0;
        }
      }
    `;
    document.head.append(style);
  };

  const installInvestigatorDoor = () => {
    const heroCopy = document.querySelector('.monster-hero-copy');
    if (!heroCopy || heroCopy.querySelector('.monster-investigator-door')) return;

    const link = document.createElement('a');
    link.className = 'monster-investigator-door';
    link.href = 'captain-breakout-investigator.html';
    link.textContent = 'MEET CB THE INVESTIGATOR →';
    heroCopy.append(link);
  };

  const getResultState = () => {
    const score = result.querySelector('.monster-launch-score-card strong')?.textContent?.trim();
    const tier = result.querySelector('.monster-launch-score-card em')?.textContent?.trim();
    if (score && score !== '—') {
      return {
        heading: `MONSTER RATING™ ${score}`,
        message: tier
          ? `${tier}. CB points to the score; the evidence on the right explains it.`
          : 'CB points to the score; the evidence on the right explains it.',
      };
    }

    const status = result.querySelector('.monster-demo-flag')?.textContent?.trim()
      || result.querySelector('[data-status]')?.textContent?.trim()
      || 'EVIDENCE STATUS';

    return {
      heading: status,
      message: 'No valid production number is available, so CB points to the truthful evidence status instead.',
    };
  };

  const installInvestigatorResult = () => {
    if (result.querySelector(':scope > .monster-investigator-panel')
      && result.querySelector(':scope > .monster-investigator-content')) {
      const state = getResultState();
      const status = result.querySelector('.monster-investigator-status');
      if (status) {
        status.innerHTML = `<strong>${state.heading}</strong>${state.message}`;
      }
      return;
    }

    if (!result.firstElementChild) {
      result.classList.remove('monster-investigator-layout');
      return;
    }

    const content = document.createElement('div');
    content.className = 'monster-investigator-content';
    while (result.firstChild) content.append(result.firstChild);

    const state = getResultState();
    const panel = document.createElement('aside');
    panel.className = 'monster-investigator-panel';
    panel.setAttribute(
      'aria-label',
      'CB the Investigator points toward the stock rating or truthful evidence status',
    );
    panel.innerHTML = `
      <img src="assets/captain-breakout-investigator.webp" alt="CB the Investigator holding a fingerprint magnifying glass and pointing toward the stock result">
      <span class="monster-investigator-arrow" aria-hidden="true"></span>
      <p class="monster-investigator-status"><strong>${state.heading}</strong>${state.message}</p>
    `;

    result.classList.add('monster-investigator-layout');
    result.append(panel, content);
  };

  const standardizeResult = () => {
    if (applying) return;
    applying = true;

    try {
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

      installInvestigatorResult();
    } finally {
      applying = false;
    }
  };

  installPresentationStyles();
  installInvestigatorDoor();

  new MutationObserver(() => {
    window.requestAnimationFrame(standardizeResult);
  }).observe(result, {
    childList: true,
    subtree: true,
  });

  standardizeResult();
})();
