<!-- TS: 2026-08-06 11:32 ET -->
# Codex Handoff: Rebuild the Working Homepage to Match the Approved Reference

Repository:
`Poppoparazzi/-TS-2026-07-28-22-35-ET-next-years-monsters-website`

Starting branch:
`handoff/codex-homepage-match-2026-08-06`

Protected reset commit:
`e92b85325b985a96ba6d323a0f0de09009ef49c1`

Protected reset branches:
- `locked/pre-codex-homepage-handoff-2026-08-06`
- `backup/pre-codex-homepage-handoff-2026-08-06`

## Objective

Rebuild the real, functional homepage so it visually matches the attached approved reference image as closely as possible at normal 100% browser zoom.

The attached image is the visual blueprint. Do not place the entire screenshot on the site as a background or replace the homepage with a single image. Recreate it with real HTML, CSS, existing image assets, and working JavaScript.

Work only on the homepage until it is approved. Do not redesign other pages.

## Required workflow

1. Create a new working branch from the handoff branch, such as:
   `codex/homepage-pixel-match-2026-08-06`
2. Inspect the existing homepage before editing.
3. Serve the site locally.
4. Render screenshots of the actual homepage at these desktop viewports:
   - 1672 x 941, matching the approved reference image
   - 1920 x 1080, matching the user's desktop
5. Compare the rendered page with the attached reference image.
6. Adjust the HTML/CSS, render again, and repeat until the layout is visually matched.
7. Do not claim completion from code inspection alone. Provide the final rendered screenshot for comparison.
8. Open a pull request. Do not push experimental work directly to `main`.

Use Playwright, Puppeteer, or the available browser/screenshot tooling for the render-and-compare loop. A pixel-diff or overlay comparison is preferred.

## Approved visual target

Match the attached reference image, including:

- Cream header across the top.
- Brand at far left.
- Navigation centered on one line.
- Black `SEARCH A STOCK` button at far right.
- Readable market ticker directly below the header.
- Compact live connection-status strip directly below the ticker.
- Dark hero area filling the remaining initial viewport.
- No part of the next section visible at the bottom of the initial desktop viewport.
- Left hero content inset from the edge, not cramped.
- Large three-line title:
  - `NEXT`
  - `YEAR'S`
  - `MONSTERS™`
- Strong condensed display type, but not vertically crushed or excessively tight.
- Fingerprint positioned near the upper center of the hero, near the boundary between text and art.
- Captain Breakout and the charging bull large, centered toward the middle, and fully visible.
- Show the bull's full body, legs, dust cloud, and rising chart arrow.
- No large empty black canyon between the text and artwork.
- Search panel proportioned like the reference, with the input filling the available width.
- Two call-to-action buttons beneath the search panel.

## Functional requirements

Preserve all real homepage functionality:

- Navigation links remain clickable.
- Market ticker remains live and readable.
- Stock/company search form remains functional.
- `RUN A MONSTER CHECK` works.
- `OPEN STOCK DIRECTORY` works.
- The data-status strip remains functional.
- `SEC EVIDENCE` must use the existing health check and display `OFFICIAL SEC · CONNECTED` when the backend reports healthy and SEC configured.
- The status script must continue using:
  - `assets/home-data-status.js`
  - `assets/runtime-config.js`
  - backend health endpoint `/api/health`
- Do not alter the backend, database, SEC ingestion, Render configuration, or stock universe.

## Existing relevant files and assets

Inspect these first:

- `index.html`
- `assets/styles.css`
- `assets/home-stock-finder.css`
- `assets/market-ticker-strip.js`
- `assets/home-data-status.js`
- `assets/runtime-config.js`
- `final bull on HOmep;age Aug 2.png`
- `assets/monster-fingerprint-green-blue.png`
- `site-version.json`

The homepage currently has overlapping style sources, including base styles, a homepage override stylesheet, and inline rules in `index.html`. Consolidate the homepage rules so one final source controls the hero. Remove or neutralize obsolete conflicting homepage rules rather than stacking more `!important` overrides indefinitely.

## Known current defects

- Desktop proportions do not match the approved reference.
- Left column is too wide on the user's 1920-pixel display, pushing the artwork too far right.
- Captain Breakout and the bull are not positioned and scaled like the reference.
- The search input/button do not fill the panel correctly because basic form-layout rules were lost during the previous stylesheet replacement.
- Header/ticker/status visibility has been confused by scroll position and non-sticky header behavior.
- Browser zoom must be tested at 100%.
- The next section must not peek into the initial desktop viewport.

## Constraints

- Do not use the approved screenshot as a full-page bitmap.
- Do not alter other pages.
- Do not alter backend or production data behavior.
- Do not remove the connection-status strip.
- Do not change the approved Captain Breakout character artwork.
- Do not replace the bull artwork with a newly generated version.
- Do not merge to `main` until the user approves the actual rendered screenshot.
- Keep a rollback path to commit `e92b85325b985a96ba6d323a0f0de09009ef49c1`.

## Acceptance criteria

The task is complete only when:

1. A browser screenshot of the working homepage at 1672 x 941 closely matches the attached approved reference.
2. A screenshot at 1920 x 1080 preserves the same proportions.
3. Header, ticker, status strip, title, fingerprint, search panel, buttons, bull, dust, and arrow are all visible and balanced.
4. The next section is not visible at the bottom of the initial desktop viewport.
5. The live ticker and SEC connection status still work.
6. Only homepage-related files are changed, unless a deployment/version marker is updated after approval.
7. The pull request includes before-and-after screenshots and a concise list of changed files.

Do not say it is finished merely because the CSS compiles. Show the rendered result.