// TS: 2026-08-05 13:52 ET
(() => {
  const result = document.querySelector('[data-result]');
  if (!result) return;

  const installContrastFix = () => {
    if (document.getElementById('monster-check-contrast-fix')) return;

    const style = document.createElement('style');
    style.id = 'monster-check-contrast-fix';
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

      @media (max-width: 900px) {
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
  };

  installContrastFix();
  installInvestigatorDoor();
  new MutationObserver(standardizeResult).observe(result, {
    childList: true,
    subtree: true,
  });
  standardizeResult();
})();
