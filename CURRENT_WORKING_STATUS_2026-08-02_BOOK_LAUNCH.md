# NextYearsMonsters — Book Launch Website Status

<!-- TS: 2026-08-02 09:39 EDT -->

## Use this file as the project anchor

Current working chat/title to look for:

**NextYearsMonsters — Book Launch Website, Live Data, Monster Check & Captain Breakout**

This file exists so the project does not get lost again across half-baked chats, vanished tabs, browser reloads, and whatever other tiny gremlins modern software keeps breeding in the walls.

## Current priority

The immediate book-release goal is the public website at **nextyearsmonsters.com**.

The site does not need the full future 2,000-stock paid engine before the book release. It does need to look professional, work cleanly for readers, and make the Monster Check experience feel real, useful, and honest.

## Locked homepage decision

The homepage hero direction is locked:

- Use the bull-riding Captain Breakout hero.
- Do not regenerate or alter the Captain Breakout artwork.
- Keep the fingerprint concept.
- Keep the bright green/black brand feel.
- Captain Breakout on the bull should remain large, bold, and visible immediately on landing.

Recent homepage commits:

- `d35568b8f691daaceaf3944bab9d8135755b9e68` — placed bull-riding Captain Breakout on homepage.
- `7fb14df2cdb3f8a080abb023d48e80d27cab3eb3` — enlarged and raised the bull-rider hero.

## First goal: Monster Check book-release upgrade

For the original 15 VCL stocks, Monster Check should show:

1. Monster Rating™ first
2. Rating tier
3. Short explanation
4. Monster DNA™
5. Tipping Point™
6. Market Weather™
7. Move Driver™
8. Link to chart
9. Link to news / filings
10. Educational disclaimer

This is the most important first upgrade because book readers are likely to try Monster Check immediately after landing on the website.

Current status: **committed v1 launch upgrade**.

Recent Monster Check commits:

- `915a59816f30193a575a33e5aa4142e7801237b0` — added `assets/monster-check-launch-result.js`.
- `075c22d75f3be70c58ba92b6f72ec1895a09f3e5` — wired the launch renderer into `monster-check.html`.

Next verification step:

- Open `monster-check.html`.
- Refresh with Ctrl+F5.
- Test `NVDA` first.
- Confirm the result shows the launch-style score-first card with rating, tier, explanation, Monster DNA™, Tipping Point™, Market Weather™, Move Driver™, chart button, news/filings button, and disclaimer.

## Next work order

1. Verify Monster Check v1 visually in the browser.
2. Fix any layout/wording issue on the Monster Check result card.
3. Make sure all 15 VCL stocks render correctly.
4. Audit the homepage to Monster Check to chart/news flow.
5. Improve SEC fallback for non-demo tickers.
6. Make News Radar book-release safe.
7. Continue live-data/database/rating-engine work after the launch-critical pages are stable.

## Launch truth

The site must be honest:

- External charts may be delayed.
- SEC identity/filings are official where connected.
- Demonstration Monster Ratings™ remain clearly labeled until live verified ratings are ready.
- No live rating, price, news item, or recommendation should be fabricated.

## Repeated line

**The screen does not find guaranteed winners. It finds evidence.**
