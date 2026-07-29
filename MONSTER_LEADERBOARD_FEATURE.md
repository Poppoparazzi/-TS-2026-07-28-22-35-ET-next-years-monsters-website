# Monster Leaderboard™ Feature Plan

<!-- TS: 2026-07-29 10:44 ET -->

## Purpose

Create a dedicated discovery page that highlights the highest current Monster Ratings™ without replacing ticker search or encouraging visitors to treat a single ranked list as investment advice.

## Working name

**Monster Leaderboard™**

Navigation label options:

- TOP MONSTERS
- MONSTER LEADERBOARD
- TOP 25

Recommended navigation label: **TOP MONSTERS**
Recommended page title: **MONSTER LEADERBOARD™**

## Core page structure

### 1. Top 25 Monster Ratings™

Display the 25 highest current ratings in the active production universe.

Each row or card should show only enough information to create curiosity:

- Rank.
- Ticker and company name.
- Current Monster Rating™ and tier.
- Rating change since the prior calculation.
- One-sentence evidence summary.
- Data freshness timestamp.
- Link to open the complete Monster Check™.

The leaderboard must not contain the full analysis. Detailed evidence, risks, catalysts, news, sources, and history belong on the individual Monster Check™ page.

### 2. Reveal positions 26–50

Use a clear **SHOW 26–50** control rather than placing all 50 results on screen immediately.

This preserves the user’s idea of a Top 50 while keeping the page from becoming a long passive list.

### 3. Discovery prompts

Place a ticker-search field and a **FIND YOUR OWN MONSTER** prompt:

- Near the top of the page.
- After rank 10.
- After rank 25.
- At the bottom of the page.

This repeatedly redirects visitors into active research instead of letting the leaderboard become the whole experience.

## Supporting lists

Keep popularity separate from rating quality.

Recommended secondary panels:

- **BIGGEST RATING RISERS** — largest positive score changes.
- **BIGGEST RATING FALLERS** — largest negative score changes.
- **MOST CHECKED TODAY** — visitor interest, clearly labeled as popularity rather than quality.
- **NEW TO THE TOP 25** — recent entrants.
- **TOP MONSTERS BY SECTOR** — strongest current rating within each sector.

Do not merge “most searched” with “highest rated.” A popular ticker is not automatically a strong Monster Rating™.

## Rollout timing

### During the 15-stock live phase

- Build and test the page structure.
- Label rankings as a limited 15-stock live pilot.
- Do not imply the list represents the full U.S. market.

### At 100 live stocks

- Publish a genuine Top 25.
- Add the optional positions 26–50 reveal.
- Add rating risers and recent entrants.

### At 500 live stocks

- Add sector leaderboards.
- Add rating-change history and ranking movement.
- Add Most Checked Today when privacy-safe analytics are available.

### At approximately 2,000 live stocks

- Activate the complete production leaderboard.
- Consider a separate Top 100 browse page while keeping the main public experience focused on the Top 25 and Top 50.

## Ranking rules

- Rankings are determined by the current Monster Rating™, not by popularity, promotion, sponsorship, or payment.
- Ties should be resolved using confidence, data completeness, and most recent rating change.
- Every ranking must include the rating timestamp and scoring-version identifier.
- Stale or incomplete ratings must be visibly marked and may be excluded from ranking.
- Rankings must update only after the corresponding Monster Rating™ calculation is saved successfully.

## Educational safeguards

Use the wording **Highest Current Monster Ratings™**, not “best stocks to buy.”

Display a persistent notice:

> Rankings summarize current evidence under the Monster Rating™ framework. They are not recommendations to buy, sell, or hold a security and can change as market conditions, company fundamentals, filings, and verified news change.

## Engagement rule

The leaderboard is a doorway, not the destination.

Success means visitors:

1. Notice an unfamiliar company.
2. Click into its Monster Check™.
3. Read the evidence and risks.
4. Compare it with another company.
5. Search a ticker of their own.

## Recommended first implementation

Build the page shell after the secure live API is deployed and the original 15 stocks return trustworthy timestamped data. Use the live 15-stock pilot first, then expand the same component to Top 25 and Top 50 as the production universe grows.
