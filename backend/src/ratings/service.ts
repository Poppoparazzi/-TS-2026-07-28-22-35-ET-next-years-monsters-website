// TS: 2026-08-05 09:36 ET

import type { MarketDataProvider } from "../providers/types.js";
import type { SecCompanyFactsSummary, SecDataProvider } from "../sec/types.js";
import { SecCompanyNotFoundError } from "../sec/types.js";
import { calculateProductionMonsterRating } from "./engine.js";
import type { CoverageCompany, RatingEvidenceStore } from "./evidence-store.js";
import { buildAnnualFinancialPeriods } from "./financial-periods.js";
import type { RatingStore, SavedRatingResult } from "./store.js";
import type { MarketBarEvidence, ProductionRatingResult } from "./types.js";

export interface RatingCalculationOutcome {
  readonly result: ProductionRatingResult;
  readonly saved: SavedRatingResult;
  readonly savedSecFactCount: number;
  readonly savedMarketBarCount: number;
}

export interface ProductionRatingServiceOptions {
  readonly secProvider: SecDataProvider;
  readonly marketProvider: MarketDataProvider;
  readonly evidenceStore: RatingEvidenceStore;
  readonly ratingStore: RatingStore;
  readonly benchmarkSymbol?: string;
  readonly clock?: () => Date;
}

function errorDetails(error: unknown): { readonly code: string; readonly message: string } {
  if (error instanceof Error) {
    return { code: error.name || "Error", message: error.message };
  }
  return { code: "UnknownError", message: String(error) };
}

function bars(history: {
  readonly bars: readonly { readonly date: string; readonly close: number; readonly volume: number }[];
}): readonly MarketBarEvidence[] {
  return Object.freeze(
    history.bars.map((bar) =>
      Object.freeze({ date: bar.date, close: bar.close, volume: bar.volume }),
    ),
  );
}

export class ProductionRatingService {
  private readonly benchmarkSymbol: string;
  private readonly clock: () => Date;
  private benchmarkPromise: Promise<readonly MarketBarEvidence[]> | null = null;

  public constructor(private readonly options: ProductionRatingServiceOptions) {
    this.benchmarkSymbol = (options.benchmarkSymbol ?? "SPY").trim().toUpperCase();
    this.clock = options.clock ?? (() => new Date());
    if (!/^[A-Z0-9.-]{1,15}$/.test(this.benchmarkSymbol)) {
      throw new Error("Rating benchmark symbol is invalid.");
    }
  }

  private now(): string {
    const date = this.clock();
    if (Number.isNaN(date.getTime())) throw new Error("Rating clock returned an invalid date.");
    return date.toISOString();
  }

  private async benchmarkBars(): Promise<readonly MarketBarEvidence[]> {
    const provider = this.options.marketProvider;
    if (!provider.configured || !provider.getDailyHistory) return Object.freeze([]);
    if (!this.benchmarkPromise) {
      this.benchmarkPromise = provider
        .getDailyHistory(this.benchmarkSymbol, 300)
        .then(bars)
        .catch((error) => {
          this.benchmarkPromise = null;
          throw error;
        });
    }
    return this.benchmarkPromise;
  }

  private async loadSecFacts(
    company: CoverageCompany,
  ): Promise<{ readonly summary: SecCompanyFactsSummary | null; readonly savedCount: number }>
  {
    if (!company.secIdentityResolved || !company.secCik) {
      return { summary: null, savedCount: 0 };
    }

    const started = Date.now();
    try {
      const summary = await this.options.secProvider.getCompanyFacts(company.symbol);
      const savedCount = await this.options.evidenceStore.saveSecFactHistory(summary);
      await this.options.evidenceStore.recordProviderHealth({
        providerType: "sec",
        providerName: this.options.secProvider.name,
        configured: this.options.secProvider.configured,
        status: "healthy",
        checkedAt: this.now(),
        latencyMs: Date.now() - started,
        failureCode: null,
        failureMessage: null,
        metadata: Object.freeze({ symbol: company.symbol, savedFactCount: savedCount }),
      });
      return { summary, savedCount };
    } catch (error) {
      const details = errorDetails(error);
      await this.options.evidenceStore.recordProviderHealth({
        providerType: "sec",
        providerName: this.options.secProvider.name,
        configured: this.options.secProvider.configured,
        status: error instanceof SecCompanyNotFoundError ? "degraded" : "failed",
        checkedAt: this.now(),
        latencyMs: Date.now() - started,
        failureCode: details.code,
        failureMessage: details.message,
        metadata: Object.freeze({ symbol: company.symbol }),
      });
      if (error instanceof SecCompanyNotFoundError) return { summary: null, savedCount: 0 };
      throw error;
    }
  }

  private async loadMarketHistory(
    company: CoverageCompany,
  ): Promise<{
    readonly companyBars: readonly MarketBarEvidence[];
    readonly benchmarkBars: readonly MarketBarEvidence[];
    readonly securityType: string | null;
    readonly savedCount: number;
  }> {
    const provider = this.options.marketProvider;
    if (!provider.configured || !provider.getDailyHistory) {
      await this.options.evidenceStore.recordProviderHealth({
        providerType: "market-data",
        providerName: provider.name,
        configured: provider.configured,
        status: "unconfigured",
        checkedAt: this.now(),
        latencyMs: null,
        failureCode: "provider_not_connected",
        failureMessage: "Licensed daily market history is not connected.",
        metadata: Object.freeze({ symbol: company.symbol }),
      });
      return {
        companyBars: Object.freeze([]),
        benchmarkBars: Object.freeze([]),
        securityType: company.securityType,
        savedCount: 0,
      };
    }

    const started = Date.now();
    try {
      const [companyHistory, benchmarkHistory] = await Promise.all([
        provider.getDailyHistory(company.symbol, 300),
        this.benchmarkBars(),
      ]);
      const savedCount = await this.options.evidenceStore.saveMarketHistory(companyHistory);
      await this.options.evidenceStore.recordProviderHealth({
        providerType: "market-data",
        providerName: provider.name,
        configured: true,
        status: "healthy",
        checkedAt: this.now(),
        latencyMs: Date.now() - started,
        failureCode: null,
        failureMessage: null,
        metadata: Object.freeze({
          symbol: company.symbol,
          benchmarkSymbol: this.benchmarkSymbol,
          savedBarCount: savedCount,
        }),
      });
      return {
        companyBars: bars(companyHistory),
        benchmarkBars: benchmarkHistory,
        securityType: company.securityType ?? companyHistory.securityType,
        savedCount,
      };
    } catch (error) {
      const details = errorDetails(error);
      await this.options.evidenceStore.recordProviderHealth({
        providerType: "market-data",
        providerName: provider.name,
        configured: true,
        status: "failed",
        checkedAt: this.now(),
        latencyMs: Date.now() - started,
        failureCode: details.code,
        failureMessage: details.message,
        metadata: Object.freeze({ symbol: company.symbol, benchmarkSymbol: this.benchmarkSymbol }),
      });
      throw error;
    }
  }

  public async calculateAndStore(company: CoverageCompany): Promise<RatingCalculationOutcome> {
    const calculatedAt = this.now();
    const sec = await this.loadSecFacts(company);
    const market = company.secIdentityResolved
      ? await this.loadMarketHistory(company)
      : {
          companyBars: Object.freeze([]) as readonly MarketBarEvidence[],
          benchmarkBars: Object.freeze([]) as readonly MarketBarEvidence[],
          securityType: company.securityType,
          savedCount: 0,
        };
    const periods = sec.summary
      ? buildAnnualFinancialPeriods(sec.summary, 5).periods
      : Object.freeze([]);
    const providerSupportsHistory = Boolean(
      this.options.marketProvider.configured && this.options.marketProvider.getDailyHistory,
    );

    const result = calculateProductionMonsterRating({
      symbol: company.symbol,
      companyName: company.companyName,
      exchange: company.exchange,
      securityType: market.securityType,
      secIdentityResolved: Boolean(sec.summary && company.secIdentityResolved),
      secCik: sec.summary ? String(sec.summary.cik).padStart(10, "0") : company.secCik,
      financialPeriods: periods,
      marketBars: market.companyBars,
      benchmarkSymbol: this.benchmarkSymbol,
      benchmarkBars: market.benchmarkBars,
      marketProviderName: providerSupportsHistory ? this.options.marketProvider.name : null,
      marketProviderConfigured: providerSupportsHistory,
      calculatedAt,
    });
    const saved = await this.options.ratingStore.saveResult(result);
    await this.options.evidenceStore.recordProviderHealth({
      providerType: "rating-engine",
      providerName: result.engineVersion,
      configured: true,
      status: "healthy",
      checkedAt: this.now(),
      latencyMs: null,
      failureCode: null,
      failureMessage: null,
      metadata: Object.freeze({
        symbol: company.symbol,
        eligible: result.eligible,
        eligibilityCode: result.eligibilityCode,
      }),
    });

    return Object.freeze({
      result,
      saved,
      savedSecFactCount: sec.savedCount,
      savedMarketBarCount: market.savedCount,
    });
  }
}
