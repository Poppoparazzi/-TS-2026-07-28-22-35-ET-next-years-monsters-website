# Monster DNA™ V2 — Historical Walk-Forward Backtest Protocol

<!-- TS: 2026-10-01 07:55 ET -->

## Why this exists

We do not need to wait six months to learn whether the new Monster DNA framework would have distinguished past winners from plausible non-winners.

We can perform a historical walk-forward test: travel back to a prior date, use only information that was public on or before that date, calculate the DNA score as it would have existed then, and compare the score with the stock's subsequent 60-, 90-, and 180-day performance.

This is much stronger than merely starting with today's known winners and asking what they had, because that would create selection bias.

## Two separate historical studies

### Study A — Winner autopsy

Start with the stocks that actually became major movers over the following six months.

For each winner, reconstruct:
- Business DNA available at the starting date
- Inflection & Expectations evidence available at the starting date
- Market Confirmation available at the starting date
- Anti-DNA warnings available at the starting date
- what subsequently caused or reinforced the move

This study discovers candidate features.

### Study B — Blind walk-forward ranking

This is the more important test.

At each historical anchor date:
1. Define the eligible universe as it existed then.
2. Use only evidence published by that date.
3. Apply one frozen Version 2 scoring rule to every eligible stock.
4. Rank the stocks without looking at future returns.
5. Freeze the Top 15.
6. Measure 60-, 90-, and 180-day stock returns and excess returns versus SPY.
7. Record hit rate, median return, average return, drawdown, and false positives.
8. Preserve the complete ranking and never revise it after seeing the outcomes.

## Initial historical anchor dates

Use multiple independent windows so one unusual market regime does not dictate the model:

- April 1, 2026 → evaluate through roughly July 1 and October 1, 2026
- January 2, 2026 → evaluate through roughly April 2 and July 2, 2026
- October 1, 2025 → evaluate through roughly January 1 and April 1, 2026
- July 1, 2025 → evaluate through roughly October 1, 2025 and January 1, 2026

Additional anchors should be added later across bull, correction, and sideways markets.

## Primary historical hit definition

A historical Top-15 candidate is a hit at the chosen horizon only when:

1. stock total return is positive, and
2. stock total return exceeds SPY over the same interval.

Also record a stricter "Monster Move" outcome:
- +25% or greater absolute return over 180 days, and
- outperformance versus SPY.

The stricter outcome is descriptive and does not replace the main hit definition.

## Mandatory anti-leakage controls

For a score dated T:
- no earnings released after T
- no guidance issued after T
- no analyst estimate revision published after T
- no price, volume, market, or sector data after T
- no later clinical result, contract, regulatory action, acquisition, or product announcement
- no later knowledge that the stock ultimately became a winner or loser may alter the scoring rubric for that window

When evidence cannot be reconstructed reliably as of T, mark the component unavailable rather than borrowing future information.

## Controls and matched non-winners

Each winner autopsy must include at least one plausible same-period non-winner from the same sector or business archetype.

Useful matching dimensions:
- sector / industry
- approximate market capitalization
- revenue growth range
- profitability stage
- valuation range
- business archetype
- current relative-strength band

The comparison asks:
- what did the winner possess that the control lacked?
- what Anti-DNA did the control possess that the winner lacked?
- were both strong businesses but only one had improving expectations?
- was the difference primarily valuation, guidance, estimate revisions, market confirmation, or a catalyst?

## Measures to retain

For every candidate and every anchor:
- raw three-pillar scores
- Anti-DNA penalty
- adjusted score
- hard-gate pass/fail
- rank
- reference price
- SPY reference price
- 60-day return
- 90-day return
- 180-day return
- 60/90/180-day excess return versus SPY
- maximum drawdown after selection
- major dated catalysts after selection
- final classification: hit / miss / Monster Move / false positive / false negative

## What would count as encouraging

Do not use a single retrospective cohort to declare success.

Evidence becomes encouraging when:
- high-score cohorts consistently outperform lower-score controls
- hard-gate failures have materially worse outcomes than hard-gate passes
- the Top 15 beats SPY on a majority of independent anchor windows
- the hit rate approaches the 75% research target across multiple historical periods
- results remain useful after including transaction-neutral losers and after avoiding post-hoc exclusions

## What would count as failure

Version 2 must be reconsidered if:
- high scores do not separate future winners from lower scores
- most apparent predictive power comes from one sector or one market regime
- the model only works after manual exclusions made with hindsight
- CRDO-type false positives remain common
- the Anti-DNA or expectations gates remove as many later winners as later losers

## Relationship to prospective testing

Historical walk-forward testing can be done now and is the fastest way to improve the model.

It cannot fully replace prospective testing because the researchers have seen the historical outcomes while designing Version 2. Therefore:

- retrospective windows = development and stress testing
- future frozen cohorts = final confirmation that the rules generalize

The goal is to make the future wait useful rather than blind: only a model that survives the historical walk-forward tests should be allowed into the prospective cohort.
