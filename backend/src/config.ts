// TS: 2026-07-29 21:46 ET

export type MarketDataProviderName = "unconfigured" | "twelve-data";

export interface AppConfig {
  readonly nodeEnv: string;
  readonly host: string;
  readonly port: number;
  readonly corsOrigins: readonly string[];
  readonly marketDataProvider: MarketDataProviderName;
  readonly twelveDataApiKey: string | null;
  readonly secUserAgent: string | null;
  readonly databaseUrl: string | null;
}

function parsePort(value: string | undefined): number {
  const parsed = Number(value ?? "8787");

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return parsed;
}

function parseProvider(value: string | undefined): MarketDataProviderName {
  const normalized = (value ?? "unconfigured").trim().toLowerCase();

  if (normalized === "unconfigured" || normalized === "twelve-data") {
    return normalized;
  }

  throw new Error(`Unsupported MARKET_DATA_PROVIDER: ${normalized}`);
}

function optionalSecret(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const corsOrigins = (environment.CORS_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Object.freeze({
    nodeEnv: environment.NODE_ENV?.trim() || "development",
    host: environment.HOST?.trim() || "0.0.0.0",
    port: parsePort(environment.PORT),
    corsOrigins: Object.freeze(corsOrigins),
    marketDataProvider: parseProvider(environment.MARKET_DATA_PROVIDER),
    twelveDataApiKey: optionalSecret(environment.TWELVE_DATA_API_KEY),
    secUserAgent: optionalSecret(environment.SEC_USER_AGENT),
    databaseUrl: optionalSecret(environment.DATABASE_URL),
  });
}
