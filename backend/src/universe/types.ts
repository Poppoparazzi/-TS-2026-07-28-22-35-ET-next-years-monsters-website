// TS: 2026-08-21 15:16 UTC

export type PipelineStatus =
  | "queued"
  | "processing"
  | "complete"
  | "partial"
  | "failed"
  | "stale"
  | "unresolved";

export interface UniverseCompany {
  readonly ticker: string;
  readonly companyName: string;
  readonly exchange: string | null;
  readonly cik: number;
  readonly cikPadded: string;
  readonly sourceUrl: string;
}

export interface UniverseImportSummary {
  readonly requestedCount: number;
  readonly importedCount: number;
  readonly database: string;
  readonly sourceUrl: string;
  readonly completedAt: string;
}

export interface UniverseCompanyStatus {
  readonly ticker: string;
  readonly companyName: string;
  readonly exchange: string | null;
  readonly secCik: string | null;
  readonly isPilot: boolean;
  readonly isProtected: boolean;
  readonly isReplacement: boolean;
  readonly secStage: PipelineStatus;
  readonly secAttemptCount: number;
  readonly lastError: string | null;
  readonly lastStartedAt: string | null;
  readonly lastCompletedAt: string | null;
  readonly nextRetryAt: string | null;
  readonly hasSecIdentity: boolean;
  readonly hasFilings: boolean;
  readonly hasFacts: boolean;
  readonly hasQuote: boolean;
  readonly hasRating: boolean;
  readonly updatedAt: string;
}

export interface UniverseStatusSummary {
  readonly configured: true;
  readonly generatedAt: string;
  readonly requestedLimit: number;
  readonly universeSize: number;
  readonly examinedCount: number;
  readonly candidatesExaminedCount: number;
  readonly queuedCount: number;
  readonly processingCount: number;
  readonly secCompleteCount: number;
  readonly secEvidenceReadyCount: number;
  readonly partialCount: number;
  readonly failedCount: number;
  readonly staleCount: number;
  readonly unresolvedCount: number;
  readonly secIdentityCount: number;
  readonly filingCompleteCount: number;
  readonly factsCompleteCount: number;
  readonly quoteCompleteCount: number;
  readonly ratingCompleteCount: number;
  readonly fullyCompleteCount: number;
  readonly finalUsableUniverseCount: number;
  readonly incompleteCount: number;
  readonly protectedTickerCount: number;
  readonly protectedPresentCount: number;
  readonly protectedMissingCount: number;
  readonly protectedMissingTickers: readonly string[];
  readonly protectedMustRepairCount: number;
  readonly protectedMustRepairTickers: readonly string[];
  readonly replaceableFailureCount: number;
  readonly replaceableFailureTickers: readonly string[];
  readonly replacementsAttemptedCount: number;
  readonly reserveCandidatesRemainingCount: number;
  readonly companies: readonly UniverseCompanyStatus[];
}

export interface UniverseStore {
  readonly name: string;
  readonly configured: boolean;
  importCompanies(companies: readonly UniverseCompany[]): Promise<UniverseImportSummary>;
  getStatus(limit: number): Promise<UniverseStatusSummary>;
  close(): Promise<void>;
}
