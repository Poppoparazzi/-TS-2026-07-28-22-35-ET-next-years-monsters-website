# Next Year’s Monsters™ Website Handoff

<!-- TS: 2026-07-29 09:10 ET -->

## Repository

`Poppoparazzi/-TS-2026-07-28-22-35-ET-next-years-monsters-website`

Live GitHub Pages test site:

`https://poppoparazzi.github.io/-TS-2026-07-28-22-35-ET-next-years-monsters-website/`

## Locked design direction

Use the approved screenshot-inspired editorial design already implemented on the home page:

- cream navigation
- black, cream, red, gold, and lime palette
- oversized condensed headlines
- full-color approved Captain Breakout™
- never crop Captain Breakout; use `object-fit: contain`
- animated red concept tape
- strong editorial sections rather than generic software cards

## Approved assets and rules

- Approved Captain Breakout file currently used as `captain_breakout.png` at repository root.
- Do not redesign, replace, regenerate, or substitute Captain Breakout.
- Bull sound is postponed. Later use only the approved TuneTank bull-mad-mooing WAV.
- Do not claim demo ratings are live ratings or investment advice.

## Current working state

### Completed and committed

- Five-page static repository created.
- GitHub Pages is active.
- Home page rebuilt in approved screenshot-inspired style.
- Captain Breakout display loading fix committed.
- Existing 15-stock JSON demonstration data works.
- `monster-check.html` was rebuilt and committed with the new editorial page structure.

Latest Monster Check page commit:

`c803a18bf3fabd0f4ea95168ed50e542ce652fe9`

### Interrupted and NOT completed

The creation of this file was interrupted and it does not yet exist:

`assets/monster-check.css`

Because `monster-check.html` references that missing stylesheet, the dedicated Monster Check page may currently look incomplete or broken.

The JavaScript result renderer in `assets/app.js` has not yet been upgraded to the new detailed result structure.

## Immediate next task

1. Create `assets/monster-check.css` matching the home-page editorial style.
2. Update `assets/app.js` so each successful stock search displays:
   - Monster Rating™ and tier
   - why it rates there
   - risk warning
   - Monster DNA™
   - recent news and rating impact placeholder clearly labeled as demonstration content
   - what could raise the rating
   - what could lower the rating
   - what to watch next
   - educational disclaimer
3. Use the existing 15-stock demonstration data for now.
4. Do not fabricate current news. Static placeholder/demo news must be clearly labeled illustrative until a real licensed API is connected.
5. Test both `index.html` and `monster-check.html` on desktop and mobile.
6. Commit every completed change immediately to `main`.

## End product

The finished website should eventually support 2,000+ U.S. ticker symbols using:

- licensed live/delayed market-data API
- verified news API
- backend scoring engine
- database for score history
- timestamps and source links

Core experience:

**Enter the symbol → see the Monster Rating™ → understand why → read material news impact → see risks → know what to watch next.**

## Other pages still needing editorial redesign

- `how-it-works.html`
- `vcl-library.html`
- `about.html`

## Conversation management rule

Start a fresh chat at each major milestone or when responses begin taking materially longer. Do not allow a single chat to accumulate the entire website build, API design, charts, screenshots, and deployment work.
