// TS: 2026-07-29 12:03 ET

import { ProviderNotConfiguredError } from "../providers/types.js";
import type {
  SecCompany,
  SecCompanyFactsSummary,
  SecDataProvider,
  SecFilingSummary,
} from "./types.js";

export class UnconfiguredSecDataProvider implements SecDataProvider {
  public readonly name = "sec-edgar-unconfigured";
  public readonly configured = false;

  public async getCompany(_symbol: string): Promise<SecCompany> {
    throw new ProviderNotConfiguredError(this.name);
  }

  public async getRecentFilings(
    _symbol: string,
    _limit = 10,
  ): Promise<readonly SecFilingSummary[]> {
    throw new ProviderNotConfiguredError(this.name);
  }

  public async getCompanyFacts(_symbol: string): Promise<SecCompanyFactsSummary> {
    throw new ProviderNotConfiguredError(this.name);
  }
}
