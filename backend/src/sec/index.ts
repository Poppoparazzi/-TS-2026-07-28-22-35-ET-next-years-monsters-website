// TS: 2026-07-29 12:10 ET

import type { AppConfig } from "../config.js";
import { SecEdgarDataProvider } from "./edgar.js";
import type { SecDataProvider } from "./types.js";
import { UnconfiguredSecDataProvider } from "./unconfigured.js";

export function createSecDataProvider(config: AppConfig): SecDataProvider {
  return config.secUserAgent
    ? new SecEdgarDataProvider(config.secUserAgent)
    : new UnconfiguredSecDataProvider();
}
