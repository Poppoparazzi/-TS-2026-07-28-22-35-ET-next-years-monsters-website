// TS: 2026-08-01 21:16 ET

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
import { createSecDataProvider } from "./sec/index.js";
import type { SecDataProvider } from "./sec/types.js";

interface TickerQuery {
  readonly q?: string;
  readonly limit?: string;
}

interface LimitQuery {
  readonly limit?: string;
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
    await Promise.all([readinessProvider.close(), persistenceStore.close()]);
  });

  app.get("/api/health", async () => ({
    status: "ok",
    service: "next-years-monsters-api",
    version: "0.4.0",
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
    timestamp: new Date().toISOString(),
  }));

  app.get("/api/readiness", async () => readinessProvider.getSnapshot());

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

  app.setErrorHandler((error, request, reply) => {
    const errorStatusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : null;
    const errorMessage = error instanceof Error ? error.message : "Request failed.";
    const statusCode =
      error instanceof ProviderNotConfiguredError
        ? 503
        : errorStatusCode !== null
          ? errorStatusCode
          : 500;

    request.log.error({ error, statusCode }, "API request failed");

    return reply.code(statusCode).send({
      error:
        error instanceof ProviderNotConfiguredError
          ? "provider_not_configured"
          : statusCode === 404
            ? "not_found"
            : "request_failed",
      message:
        statusCode >= 500 && !(error instanceof ProviderNotConfiguredError)
          ? "The data service could not complete the request."
          : errorMessage,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
