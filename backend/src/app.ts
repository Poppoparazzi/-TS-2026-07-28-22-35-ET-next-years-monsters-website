// TS: 2026-08-21 17:31 UTC

import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { loadConfig, type AppConfig } from "./config.js";
import {
  createPersistenceStore,
  type PersistenceStore,
} from "./database/persistence.js";
import {
  createDatabaseReadinessProvider,
  type DatabaseReadinessProvider,
} from "./database/readiness.js";
import { createMarketDataProvider } from "./providers/index.js";
import {
  type MarketDataProvider,
  ProviderNotConfiguredError,
} from "./providers/types.js";
import { QuoteService } from "./quotes/service.js";
import { installFailClosedRatingErrorHandler } from "./ratings/install-fail-closed-handler.js";
import { evaluatePublicRatingReadiness } from "./ratings/public-rating-readiness.js";
import {
  calculateMonsterRatingV1,
  MONSTER_RATING_ENGINE_VERSION,
} from "./ratings/engine-v1.js";
import {
  buildPublishableRating,
  buildProductionRatingInput,
  quoteFromDailyHistory,
} from "./ratings/input-builder.js";
import { createSecDataProvider } from "./sec/index.js";
import type { SecDataProvider } from "./sec/types.js";
import { createUniverseStore } from "./universe/store.js";
import type { UniverseStore } from "./universe/types.js";

interface TickerQuery {
  readonly q?: string;
  readonly limit?: string;
}

interface LimitQuery {
  readonly limit?: string;
}

interface UniverseSearchQuery extends TickerQuery {
  readonly evidenceReady?: string;
}

interface SymbolParams {
  readonly symbol: string;
}

interface SymbolsQuery {
  readonly symbols?: string;
}

export interface BuildAppOptions {
  readonly config?: AppConfig;
  readonly provider?: MarketDataProvider;
  readonly secProvider?: SecDataProvider;
  readonly readinessProvider?: DatabaseReadinessProvider;
  readonly persistenceStore?: PersistenceStore;
  readonly universeStore?: UniverseStore;
  readonly quoteCacheTtlMs?: number;
  readonly quoteBatchConcurrency?: number;
  readonly logger?: boolean;
}

function normalizeTickerSymbol(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9.-]{1,15}$/.test(normalized) ? normalized : null;
}

function parseLimit(value: string | undefined, defaultValue: number, maximum: number): number {
  const requested = Number(value ?? String(defaultValue));
  return Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), maximum)
    : defaultValue;
}

function sendInvalidSymbol(reply: FastifyReply) {
  return reply.code(400).send({
    error: "invalid_symbol",
    message: "Ticker symbols may contain only letters, numbers, periods, and hyphens.",
  });
}

function parseSymbolList(value: string): {
  readonly symbols: readonly string[];
  readonly invalidSymbols: readonly string[];
  readonly requestedCount: number;
} {
  const requested = value
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);
  const symbols: string[] = [];
  const invalidSymbols: string[] = [];
  const seen = new Set<string>();

  for (const requestedSymbol of requested) {
    const normalized = normalizeTickerSymbol(requestedSymbol);
    if (!normalized) {
      invalidSymbols.push(requestedSymbol);
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    symbols.push(normalized);
  }

  return { symbols, invalidSymbols, requestedCount: requested.length };
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const provider = options.provider ?? createMarketDataProvider(config);
  const quoteService = new QuoteService(provider, {
    cacheTtlMs: options.quoteCacheTtlMs,
    batchConcurrency: options.quoteBatchConcurrency,
  });
  const secProvider = options.secProvider ?? createSecDataProvider(config);
  const readinessProvider =
    options.readinessProvider ?? createDatabaseReadinessProvider(config);
  const persistenceStore = options.persistenceStore ?? createPersistenceStore(config);
  const universeStore = options.universeStore ?? createUniverseStore(config);
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: config.nodeEnv === "production" ? "info" : "debug",
          },
  });

  const allowedOrigins = [...config.corsOrigins];

  await app.register(cors, {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ["GET", "OPTIONS"],
  });

  app.addHook("onClose", async () => {
    await Promise.all([
      readinessProvider.close(),
      persistenceStore.close(),
      universeStore.close(),
    ]);
  });

  app.get("/api/health", async () => ({
    status: "ok",
    service: "next-years-monsters-api",
    version: "0.6.0",
    timestamp: new Date().toISOString(),
    marketData: {
      provider: provider.name,
      configured: provider.configured,
    },
    sec: {
      provider: secProvider.name,
      configured: secProvider.configured,
    },
    database: {
      provider: persistenceStore.name,
      configured: persistenceStore.configured,
    },
    universe: {
      provider: universeStore.name,
      configured: universeStore.configured,
    },
  }));

  app.get("/api/provider-status", async () => ({
    marketData: {
      provider: provider.name,
      configured: provider.configured,
      secretExposed: false,
    },
    sec: {
      provider: secProvider.name,
      configured: secProvider.configured,
      userAgentExposed: false,
    },
    database: {
      provider: persistenceStore.name,
      configured: persistenceStore.configured,
      connectionStringExposed: false,
    },
    universe: {
      provider: universeStore.name,
      configured: universeStore.configured,
      connectionStringExposed: false,
    },
    timestamp: new Date().toISOString(),
  }));

  app.get("/api/readiness", async () => readinessProvider.getSnapshot());

  app.get<{ Querystring: LimitQuery }>("/api/universe/status", async (request) => {
    const limit = parseLimit(request.query.limit, 100, 5_000);
    return universeStore.getStatus(limit);
  });

  app.get<{ Querystring: UniverseSearchQuery }>(
    "/api/universe/search",
    async (request, reply) => {
      const query = request.query.q?.trim().replace(/\s+/g, " ") ?? "";
      if (query.length > 100) {
        return reply.code(400).send({
          error: "query_too_long",
          message: "Stock-directory searches may contain no more than 100 characters.",
        });
      }

      const limit = parseLimit(request.query.limit, 12, 25);
      const evidenceReadyOnly = ["1", "true", "yes"].includes(
        String(request.query.evidenceReady ?? "").trim().toLowerCase(),
      );
      const directory = await universeStore.searchCompanies(
        query,
        limit,
        evidenceReadyOnly,
      );

      reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
      return {
        query: directory.query,
        count: directory.results.length,
        evidenceReadyOnly,
        results: directory.results,
        universe: {
          candidateCount: directory.universeSize,
          secEvidenceReadyCount: directory.secEvidenceReadyCount,
          protectedTickerCount: directory.protectedTickerCount,
          protectedMustRepairCount: directory.protectedMustRepairCount,
          replaceableFailureCount: directory.replaceableFailureCount,
        },
        retrievedAt: new Date().toISOString(),
      };
    },
  );

  app.get<{ Params: SymbolParams }>("/api/stored/:symbol", async (request, reply) => {
    const symbol = normalizeTickerSymbol(request.params.symbol);
    if (!symbol) return sendInvalidSymbol(reply);

    const snapshot = await persistenceStore.getStoredCompany(symbol);
    if (!snapshot) {
      return reply.code(404).send({
        error: "stored_company_not_found",
        message: `No persisted record was found for ${symbol}.`,
      });
    }

    return {
      ...snapshot,
      database: persistenceStore.name,
      retrievedAt: new Date().toISOString(),
    };
  });

  app.get<{ Querystring: TickerQuery }>("/api/tickers", async (request, reply) => {
    const query = request.query.q?.trim() ?? "";

    if (!query) {
      return reply.code(400).send({
        error: "missing_query",
        message: "Provide a ticker or company query using ?q=.",
      });
    }

    const limit = parseLimit(request.query.limit, 10, 25);
    const results = await provider.searchTickers(query, limit);

    return {
      query,
      count: results.length,
      results,
      provider: provider.name,
      retrievedAt: new Date().toISOString(),
    };
  });

  app.get<{ Params: SymbolParams }>("/api/quotes/:symbol", async (request, reply) => {
    const symbol = normalizeTickerSymbol(request.params.symbol);
    if (!symbol) return sendInvalidSymbol(reply);

    const quote = await quoteService.getQuote(symbol);
    if (persistenceStore.configured) {
      await persistenceStore.saveQuote(quote).catch((error) => {
        request.log.error({ error, symbol }, "Unable to persist quote snapshot");
      });
    }
    return quote;
  });

  app.get<{ Querystring: SymbolsQuery }>("/api/quotes", async (request, reply) => {
    const rawSymbols = request.query.symbols?.trim() ?? "";
    if (!rawSymbols) {
      return reply.code(400).send({
        error: "missing_symbols",
        message: "Provide one to 25 comma-separated ticker symbols using ?symbols=.",
      });
    }

    const parsed = parseSymbolList(rawSymbols);
    if (parsed.requestedCount > 25) {
      return reply.code(400).send({
        error: "too_many_symbols",
        message: "A batch quote request may contain no more than 25 ticker symbols.",
      });
    }
    if (parsed.invalidSymbols.length > 0) {
      return reply.code(400).send({
        error: "invalid_symbols",
        message: "One or more ticker symbols contain unsupported characters.",
        invalidSymbols: parsed.invalidSymbols,
      });
    }
    if (parsed.symbols.length === 0) {
      return reply.code(400).send({
        error: "missing_symbols",
        message: "Provide one to 25 comma-separated ticker symbols using ?symbols=.",
      });
    }
    if (!provider.configured) {
      throw new ProviderNotConfiguredError(provider.name);
    }

    const results = await quoteService.getQuotes(parsed.symbols);
    const successCount = results.filter((result) => result.status === "ok").length;

    if (persistenceStore.configured) {
      const saveResults = await Promise.allSettled(
        results
          .filter((result) => result.status === "ok")
          .map((result) => persistenceStore.saveQuote(result.quote)),
      );
      const failedSaves = saveResults.filter((result) => result.status === "rejected").length;
      if (failedSaves > 0) {
        request.log.error({ failedSaves }, "Unable to persist one or more batch quote snapshots");
      }
    }

    return {
      requestedCount: parsed.symbols.length,
      successCount,
      failureCount: results.length - successCount,
      results,
      provider: provider.name,
      cacheTtlSeconds: Math.max(Math.round((options.quoteCacheTtlMs ?? 60_000) / 1_000), 1),
      retrievedAt: new Date().toISOString(),
    };
  });

  app.get<{ Params: SymbolParams }>("/api/ratings/:symbol", async (request, reply) => {
    const symbol = normalizeTickerSymbol(request.params.symbol);
    if (!symbol) return sendInvalidSymbol(reply);

    if (persistenceStore.configured && persistenceStore.getLatestRating) {
      const storedRating = await persistenceStore.getLatestRating(symbol);
      if (storedRating) {
        reply.header("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
        return {
          ...storedRating,
          reasons: [],
          rollout: {
            cohort: "top_500",
            status: "rated",
            message: "Verified Monster Rating™ available.",
          },
        };
      }
    }

    const calculatedAt = new Date().toISOString();
    if (!provider.configured || !provider.getDailyHistory) {
      throw new ProviderNotConfiguredError("Licensed historical market-data provider");
    }

    const [secCompany, filings, secFacts, companyHistory, benchmarkHistory] = await Promise.all([
      secProvider.getCompany(symbol),
      secProvider.getRecentFilings(symbol, 1),
      secProvider.getCompanyFacts(symbol),
      provider.getDailyHistory(symbol, 300),
      provider.getDailyHistory("SPY", 300),
    ]);
    const quote = quoteFromDailyHistory(secCompany, companyHistory);

    const calculatedRating = calculateMonsterRatingV1(buildProductionRatingInput({
      company: secCompany,
      facts: secFacts,
      companyHistory,
      benchmarkHistory,
      benchmarkSymbol: "SPY",
      calculatedAt,
    }));
    const riskComponent = calculatedRating.components.find(
      (component) => component.key === "risk_deterioration",
    );

    const readiness = evaluatePublicRatingReadiness({
      symbol,
      quote,
      secCompany,
      secFacts,
      riskEvidence: calculatedRating.eligible && riskComponent
        ? {
            symbol,
            verified: true,
            source: `${MONSTER_RATING_ENGINE_VERSION}: SEC-derived financial-risk component`,
            retrievedAt: secFacts.retrievedAt,
          }
        : null,
      calculation: calculatedRating.eligible
        ? {
            symbol,
            score: calculatedRating.score,
            modelVersion: calculatedRating.engineVersion,
            calculatedAt: calculatedRating.calculatedAt,
          }
        : null,
      now: new Date(calculatedAt),
    });
    const publishableRating = calculatedRating.eligible
      ? buildPublishableRating({
          rating: calculatedRating,
          facts: secFacts,
          filings,
          quote,
          secProviderName: secProvider.name,
        })
      : null;
    const evidenceInputs = publishableRating?.evidenceInputs ?? calculatedRating.evidenceInputs;

    const failedGates = Object.entries(readiness.gates)
      .filter(([, gate]) => !gate.ready)
      .map(([key, gate]) => ({
        code: `gate_${key}`,
        message: gate.reason,
      }));
    if (!calculatedRating.eligible) {
      return {
        ...calculatedRating,
        tier: "NOT YET RATED",
        evidenceInputs,
        rollout: {
          cohort: "top_500",
          status: "rating_in_progress",
          message: "Not Yet Rated — Stay Tuned. Coming Soon.",
        },
      };
    }

    if (!readiness.ready) {
      return {
        symbol,
        companyName: calculatedRating.companyName,
        engineVersion: MONSTER_RATING_ENGINE_VERSION,
        calculatedAt,
        eligible: false,
        score: null,
        tier: "NOT YET RATED",
        eligibilityCode: "required_evidence_incomplete",
        summary: "Not Yet Rated — Stay Tuned. Coming Soon. One or more production evidence gates did not pass.",
        evidenceInputs,
        components: calculatedRating.components,
        reasons: failedGates,
        rollout: {
          cohort: "top_500",
          status: "rating_in_progress",
          message: "Not Yet Rated — Stay Tuned. Coming Soon.",
        },
      };
    }

    if (persistenceStore.configured && persistenceStore.saveRating) {
      try {
        await persistenceStore.saveSecCompany(secCompany);
        await Promise.all([
          persistenceStore.saveQuote(quote),
          persistenceStore.saveSecFilings(secCompany, filings),
          persistenceStore.saveSecFacts(secFacts),
        ]);
        await persistenceStore.saveRating(publishableRating ?? calculatedRating);
      } catch (error) {
        request.log.error({ error, symbol }, "Unable to persist complete Monster Rating evidence");
      }
    }

    return {
      ...(publishableRating ?? calculatedRating),
      evidenceInputs,
      reasons: [],
      rollout: {
        cohort: "top_500",
        status: "rated",
        message: "Verified Monster Rating™ available.",
      },
    };
  });

  app.get<{ Params: SymbolParams }>("/api/sec/company/:symbol", async (request, reply) => {
    const symbol = normalizeTickerSymbol(request.params.symbol);
    if (!symbol) return sendInvalidSymbol(reply);

    const company = await secProvider.getCompany(symbol);
    if (persistenceStore.configured) {
      await persistenceStore.saveSecCompany(company).catch((error) => {
        request.log.error({ error, symbol }, "Unable to persist SEC company record");
      });
    }
    return company;
  });

  app.get<{ Params: SymbolParams; Querystring: LimitQuery }>(
    "/api/sec/filings/:symbol",
    async (request, reply) => {
      const symbol = normalizeTickerSymbol(request.params.symbol);
      if (!symbol) return sendInvalidSymbol(reply);

      const limit = parseLimit(request.query.limit, 10, 50);
      const [company, filings] = await Promise.all([
        secProvider.getCompany(symbol),
        secProvider.getRecentFilings(symbol, limit),
      ]);

      if (persistenceStore.configured) {
        await persistenceStore.saveSecFilings(company, filings).catch((error) => {
          request.log.error({ error, symbol }, "Unable to persist SEC filings");
        });
      }

      return {
        ticker: symbol,
        count: filings.length,
        filings,
        provider: secProvider.name,
        retrievedAt: new Date().toISOString(),
      };
    },
  );

  app.get<{ Params: SymbolParams }>("/api/sec/facts/:symbol", async (request, reply) => {
    const symbol = normalizeTickerSymbol(request.params.symbol);
    if (!symbol) return sendInvalidSymbol(reply);

    const summary = await secProvider.getCompanyFacts(symbol);
    if (persistenceStore.configured) {
      await persistenceStore.saveSecFacts(summary).catch((error) => {
        request.log.error({ error, symbol }, "Unable to persist SEC company facts");
      });
    }
    return summary;
  });

  installFailClosedRatingErrorHandler(app);

  return app;
}
