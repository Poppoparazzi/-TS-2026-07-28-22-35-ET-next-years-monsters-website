# Monster Rating™ Production Specification v1

<!-- TS: 2026-08-05 11:28 ET -->

## Status

Engine version: `nym-rating-v1.0.0`

This specification defines the first deterministic production Monster Rating™ calculation. It does not convert or relabel the original 15 VCL™ Demonstration Ratings. Those remain historical teaching examples until the production engine independently calculates a rating from verified current inputs.

## Truth boundary

A production rating is created only when all minimum evidence requirements pass. Missing providers, unresolved SEC identities, unsupported securities, stale observations, insufficient history, low liquidity, and incomplete evidence produce an unrated result with exact machine-readable reasons. They never produce an estimated or demonstration score.

Required public labels remain:

- Official SEC Evidence
- External Market Data · May Be Delayed
- Demonstration Rating
- Not Yet Rated
- Unresolved SEC Identity
- Provider Not Connected

## Eligibility requirements

The first production model requires:

1. A verified SEC company identity and CIK.
2. A supported operating-company equity security. ETFs, funds, trusts, warrants, rights, units, preferred securities, notes, and bonds are excluded from v1.
3. A connected licensed market-data provider.
4. At least two comparable financial periods containing revenue and either diluted EPS or net income.
5. At least 126 valid company trading sessions.
6. At least 126 valid benchmark trading sessions.
7. A latest market observation no more than seven days old.
8. Average 20-session dollar volume of at least $500,000.
9. A verified data-completeness score of at least 70.

Foreign operating companies and depositary receipts may remain eligible when the SEC identity is resolved and comparable filed evidence is available. The formula does not assume that every issuer files a U.S. 10-K.

## Components and weights

| Component | Weight |
|---|---:|
| Monster DNA™ | 10% |
| Tipping Point™ | 10% |
| Market Weather™ | 6% |
| Move Driver™ | 8% |
| Monster Climb™ | 10% |
| Business Quality | 10% |
| Growth and Acceleration | 10% |
| Earnings and Revenue Evidence | 8% |
| Price and Volume Leadership | 8% |
| Relative Strength | 6% |
| Liquidity and Tradability | 5% |
| Risk and Deterioration Signals | 5% |
| Data Freshness and Completeness | 4% |
| **Total** | **100%** |

Each component is normalized to 0–100. The final score is the rounded sum of each component score multiplied by its fixed weight, bounded to 1–100 for eligible companies.

## Evidence calculations

The engine derives its evidence from supplied verified inputs rather than from ticker-specific exceptions.

Financial evidence includes:

- revenue growth;
- revenue growth acceleration when a third comparable period exists;
- diluted EPS growth or net-income growth;
- gross, operating, net, and operating-cash-flow margins;
- return on assets;
- liabilities to assets;
- cash to liabilities;
- positive or negative revenue, earnings, EPS, and operating-cash-flow availability.

Market evidence includes:

- 20-, 63-, and 126-session returns;
- 126-session return relative to the configured benchmark;
- proximity to the trailing high;
- recent volume relative to the prior 20-session period;
- average 20-session dollar volume;
- annualized volatility;
- trailing maximum drawdown;
- 63- and 126-session benchmark returns.

Every output includes the engine version, calculation time, evidence timestamps, component weights, component explanations, completeness, positive drivers, negative drivers, and the source references supplied to the calculation.

## Tier bands

The Product Bible identifies an unresolved owner decision at score `92` because previously discussed bands overlapped:

- Gold: 85–92
- Platinum: 92–100

Production code must not silently decide that score `92` is Gold or Platinum. Until the owner approves an exact boundary, the numerical Production Monster Rating™ remains controlling and score `92` receives the explicit tier label `Tier Boundary Unresolved`.

| Score | Tier |
|---:|---|
| 93–100 | Platinum |
| 92 | Tier Boundary Unresolved |
| 85–91 | Gold |
| 75–84 | Silver |
| 65–74 | Bronze |
| 50–64 | Goblin |
| 1–49 | Cemetery Risk |

The published VCL™ examples may contain explicitly documented print exceptions. Those exceptions do not alter the production formula or tier boundaries.

## Confidence

Confidence is determined only after eligibility passes:

- High: completeness at least 90.
- Medium: completeness 80–89.9.
- Low: completeness 70–79.9.
- Unavailable: not eligible.

Confidence is not a prediction of investment success. It reports the completeness of the evidence supporting the calculation.

## Reproducibility

For an identical input object and identical engine version, the result is identical. The engine contains no random values, current-clock calls, external requests, ticker overrides, or tuning against the 15 demonstration scores. The calculation timestamp is supplied explicitly by the calling batch or API and stored with the result.

## Next integration steps

The engine must be connected to:

1. comparable historical SEC financial observations;
2. licensed company and benchmark price/volume history;
3. persistent rating runs, components, sources, eligibility reasons, and history;
4. read APIs for current rating, components, history, and batch status;
5. a resumable full-universe rating batch;
6. Monster Check™ production rendering.

Until those integrations are deployed and verified, the live production rating count remains zero and public pages must continue to display Not Yet Rated or Provider Not Connected as appropriate.
