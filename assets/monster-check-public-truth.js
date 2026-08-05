// TS: 2026-08-05 13:29 ET
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
  new MutationObserver(standardizeResult).observe(result, {
    childList: true,
    subtree: true,
  });
  standardizeResult();
})();
