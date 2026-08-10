// TS: 2026-08-10 03:04 UTC

import type { SecCompanyFactsSummary, SecDataProvider } from "../sec/types.js";
import type { MarketEvidenceSource } from "./market-evidence.js";
import type {
  ProductionRatingAssemblySource,
  VerifiedRiskEvidence,
} from "./production-input.js";
import type { SingleSymbolEvidenceLoader } from "./single-symbol-orchestrator.js";

export interface ProductionMarketEvidenceProvider {
  readonly name: string;
  readonly configured: boolean;
  load(symbol: string, calculatedAt: string): Promise<MarketEvidenceSource>;
}

export interface ProductionRiskEvidenceProvider {
  readonly name: string;
  readonly configured: boolean;
  load(symbol: string, calculatedAt: string): Promise<VerifiedRiskEvidence>;
}

export interface ProductionEvidenceLoaderDependencies {
  readonly secProvider: SecDataProvider;
  readonly companyMarketProvider?: ProductionMarketEvidenceProvider | null;
  readonly benchmarkMarketProvider?: ProductionMarketEvidenceProvider | null;
  readonly riskProvider?: ProductionRiskEvidenceProvider | null;
  readonly benchmarkSymbol?: string;
}

function normalizeSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)) {
    throw new Error("Ticker symbol contains unsupported characters.");
  }
  return symbol;
}

function unavailableSecFacts(symbol: string, calculatedAt: string): SecCompanyFactsSummary {
  return Object.freeze({
    ticker: symbol,
    cik: 0,
    companyName: symbol,
    retrievedAt: calculatedAt,
    facts: Object.freeze({}),
    factHistory: Object.freeze({}),
    sourceUrl: "",
    disclosure: "SEC evidence unavailable for this rating attempt.",
  });
}

function unavailableMarketEvidence(
  symbol: string,
  provider: ProductionMarketEvidenceProvider | null | undefined,
): MarketEvidenceSource {
  return Object.freeze({
    providerName: provider?.name?.trim() || null,
    providerConfigured: provider?.configured === true,
    fetchedAt: null,
    symbol,
    bars: Object.freeze([]),
  });
}

function unavailableRiskEvidence(
  provider: ProductionRiskEvidenceProvider | null | undefined,
): VerifiedRiskEvidence {
  return Object.freeze({
    verified: false,
    checkedAt: null,
    source: provider?.name?.trim() || null,
    flags: Object.freeze([]),
  });
}

/**
 * Production evidence collector for one Current Stock Rating™ attempt.
 *
 * This class never calculates a score and never substitutes synthetic evidence.
 * Provider absence or request failure is represented as missing evidence so the
 * downstream assembler returns Data Incomplete / Not Yet Rated.
 */
export class ProductionSingleSymbolEvidenceLoader implements SingleSymbolEvidenceLoader {
  public readonly configured = true;

  private readonly benchmarkSymbol: string;

  public constructor(private readonly dependencies: ProductionEvidenceLoaderDependencies) {
    this.benchmarkSymbol = normalizeSymbol(dependencies.benchmarkSymbol ?? "SPY");
  }

  private async loadSec(symbol: string, calculatedAt: string): Promise<{
    readonly companyName: string;
    readonly exchange: string | null;
    readonly secIdentityResolved: boolean;
    readonly secCik: string | null;
    readonly secFacts: SecCompanyFactsSummary;
  }> {
    if (!this.dependencies.secProvider.configured) {
      return Object.freeze({
        companyName: symbol,
        exchange: null,
        secIdentityResolved: false,
        secCik: null,
        secFacts: unavailableSecFacts(symbol, calculatedAt),
      });
    }

    try {
      const company = await this.dependencies.secProvider.getCompany(symbol);
      const facts = await this.dependencies.secProvider.getCompanyFacts(symbol);
      const companySymbol = normalizeSymbol(company.ticker);
      const factsSymbol = normalizeSymbol(facts.ticker);

      if (companySymbol !== symbol || factsSymbol !== symbol || facts.cik !== company.cik) {
        return Object.freeze({
          companyName: company.companyName,
          exchange: company.exchange,
          secIdentityResolved: false,
          secCik: null,
          secFacts: facts,
        });
      }

      return Object.freeze({
        companyName: facts.companyName.trim() || company.companyName,
        exchange: company.exchange,
        secIdentityResolved: true,
        secCik: company.cikPadded,
        secFacts: facts,
      });
    } catch {
      return Object.freeze({
        companyName: symbol,
        exchange: null,
        secIdentityResolved: false,
        secCik: null,
        secFacts: unavailableSecFacts(symbol, calculatedAt),
      });
    }
  }

  private async loadMarket(
    symbol: string,
    calculatedAt: string,
    provider: ProductionMarketEvidenceProvider | null | undefined,
  ): Promise<MarketEvidenceSource> {
    if (!provider?.configured) return unavailableMarketEvidence(symbol, provider);

    try {
      const evidence = await provider.load(symbol, calculatedAt);
      if (normalizeSymbol(evidence.symbol) !== symbol) {
        return unavailableMarketEvidence(symbol, provider);
      }
      return evidence;
    } catch {
      return unavailableMarketEvidence(symbol, provider);
    }
  }

  private async loadRisk(
    symbol: string,
    calculatedAt: string,
  ): Promise<VerifiedRiskEvidence> {
    const provider = this.dependencies.riskProvider;
    if (!provider?.configured) return unavailableRiskEvidence(provider);

    try {
      return await provider.load(symbol, calculatedAt);
    } catch {
      return unavailableRiskEvidence(provider);
    }
  }

  public async load(
    rawSymbol: string,
    calculatedAt: string,
  ): Promise<ProductionRatingAssemblySource> {
    const symbol = normalizeSymbol(rawSymbol);
    const sec = await this.loadSec(symbol, calculatedAt);

    const [companyMarket, benchmarkMarket, riskEvidence] = await Promise.all([
      this.loadMarket(
        symbol,
        calculatedAt,
        this.dependencies.companyMarketProvider,
      ),
      this.loadMarket(
        this.benchmarkSymbol,
        calculatedAt,
        this.dependencies.benchmarkMarketProvider ?? this.dependencies.companyMarketProvider,
      ),
      this.loadRisk(symbol, calculatedAt),
    ]);

    return Object.freeze({
      symbol,
      companyName: sec.companyName,
      exchange: sec.exchange,
      securityType: null,
      secIdentityResolved: sec.secIdentityResolved,
      secCik: sec.secCik,
      secFacts: sec.secFacts,
      companyMarket,
      benchmarkMarket,
      benchmarkSymbol: this.benchmarkSymbol,
      riskEvidence,
      calculatedAt,
    });
  }
}
