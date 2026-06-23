import type { ForecastCategory, OutcomeType, ResolutionStatus, SourcePlatform } from "@prisma/client";

export type NormalizedMarketInput = {
  sourcePlatform: SourcePlatform;
  sourceMarketId: string;
  sourceSlug?: string | null;
  question: string;
  eventTitle: string;
  category: ForecastCategory;
  outcomeType: OutcomeType;
  outcomes: Array<{ name: string; probability?: number | null; tokenId?: string | null }>;
  currentProbability?: number | null;
  bid?: number | null;
  ask?: number | null;
  midpoint?: number | null;
  volume?: number | null;
  liquidity?: number | null;
  openInterest?: number | null;
  tradeCount?: number | null;
  participantCount?: number | null;
  closeTime?: Date | null;
  resolutionStatus: ResolutionStatus;
  sourceUrl?: string | null;
  lastUpdated: Date;
  observedAt: Date;
  rawPayload: unknown;
  embedding?: number[] | null;
};

export type MarketConnector = {
  sourcePlatform: SourcePlatform;
  fetchMarkets(now?: Date): Promise<NormalizedMarketInput[]>;
  getDiagnostics?(): { errors: string[] };
};
