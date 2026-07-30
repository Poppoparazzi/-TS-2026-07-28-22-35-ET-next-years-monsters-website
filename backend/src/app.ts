// TS: 2026-07-29 21:49 ET

import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { loadConfig, type AppConfig } from "./config.js";
import {
  createDatabaseReadinessProvider,
  type DatabaseReadinessProvider,
} from "./database/readiness.js";
import { createMarketDataProvider } from "./providers/index.js";
import {
  type MarketDataProvider,
  ProviderNotConfiguredError,
} from "./providers/types.js";
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

export interface BuildAppOptions {
  readonly config?: AppConfig;
  readonly provider?: MarketDataProvider;
  readonly secProvider?: SecDataProvider;
  readonly readinessProvider?: DatabaseReadinessProvider;
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

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const provider = options.provider ?? createMarketDataProvider(config);
  const secProvider = options.secProvider ?? createSecDataProvider(config);
  const readinessProvider =
    options.readinessProvider ?? createDatabaseReadinessProvider(config);
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
    await readinessProvider.close();
  });

  app.get("/api/health", async () => ({
    status: "ok",
    service: "next-years-monsters-api",
    version: "0.3.0",
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
      provider: readinessProvider.name,
      configured: readinessProvider.configured,
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
      provider: readinessProvider.name,
      configured: readinessProvider.configured,
      connectionStringExposed: false,
    },
    timestamp: new Date().toISOString(),
  }));

  app.get("/api/readiness", async () => readinessProvider.getSnapshot());

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
    return provider.getQuote(symbol);
  });

  app.get<{ Params: SymbolParams }>("/api/sec/company/:symbol", async (request, reply) => {
    const symbol = normalizeTickerSymbol(request.params.symbol);
    if (!symbol) return sendInvalidSymbol(reply);
    return secProvider.getCompany(symbol);
  });

  app.get<{ Params: SymbolParams; Querystring: LimitQuery }>(
    "/api/sec/filings/:symbol",
    async (request, reply) => {
      const symbol = normalizeTickerSymbol(request.params.symbol);
      if (!symbol) return sendInvalidSymbol(reply);

      const limit = parseLimit(request.query.limit, 10, 50);
      const filings = await secProvider.getRecentFilings(symbol, limit);

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
    return secProvider.getCompanyFacts(symbol);
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode =
      error instanceof ProviderNotConfiguredError
        ? 503
        : typeof error.statusCode === "number"
          ? error.statusCode
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
          : error.message,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
