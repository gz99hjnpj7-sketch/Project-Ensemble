import { describe, expect, it, vi } from "vitest";
import { ForecastCategory, OutcomeType, ResolutionStatus, SourcePlatform } from "@prisma/client";
import { persistMarketObservation } from "@/ensemble/ingestion/persist";
import type { NormalizedMarketInput } from "@/ensemble/connectors/types";
import type { MatchResult } from "@/ensemble/matching/types";

describe("persistMarketObservation", () => {
  it("persists inverse match metadata on cluster membership", async () => {
    const db = createDbMock();
    await persistMarketObservation(db as any, createMarketInput(), "run-1", createMatch(true), new Date("2026-06-23T00:00:00.000Z"));

    expect(db.clusterMarket.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ requiresInversion: true }),
      update: expect.objectContaining({ requiresInversion: true })
    }));
  });

  it("persists direct match metadata as non-inverted on cluster membership", async () => {
    const db = createDbMock();
    await persistMarketObservation(db as any, createMarketInput(), "run-1", createMatch(false), new Date("2026-06-23T00:00:00.000Z"));

    expect(db.clusterMarket.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ requiresInversion: false }),
      update: expect.objectContaining({ requiresInversion: false })
    }));
  });
});

function createDbMock() {
  return {
    normalizedMarket: {
      upsert: vi.fn().mockResolvedValue({ id: "market-1", createdAt: new Date("2026-06-22T00:00:00.000Z") })
    },
    marketSnapshot: {
      create: vi.fn().mockResolvedValue({ id: "snapshot-1", currentProbability: 0.8 }),
      findFirst: vi.fn().mockResolvedValue(null)
    },
    marketQualityScore: {
      create: vi.fn().mockResolvedValue({})
    },
    signalWarning: {
      createMany: vi.fn().mockResolvedValue({})
    },
    matchDecision: {
      create: vi.fn().mockResolvedValue({})
    },
    clusterMarket: {
      upsert: vi.fn().mockResolvedValue({})
    }
  };
}

function createMatch(requiresInversion: boolean): MatchResult {
  return {
    kind: "matched",
    clusterId: "cluster-1",
    confidence: 0.9,
    method: "deterministic",
    reason: "Matched test rule",
    requiresInversion
  };
}

function createMarketInput(): NormalizedMarketInput {
  return {
    sourcePlatform: SourcePlatform.POLYMARKET,
    sourceMarketId: "source-1",
    sourceSlug: "source-slug",
    question: "Will no Fed rate cuts happen in 2026?",
    eventTitle: "Fed cuts",
    category: ForecastCategory.MACRO,
    outcomeType: OutcomeType.BINARY,
    outcomes: [{ name: "Yes", probability: 0.8 }],
    currentProbability: 0.8,
    bid: 0.79,
    ask: 0.81,
    midpoint: 0.8,
    volume: 100_000,
    liquidity: 100_000,
    openInterest: null,
    tradeCount: null,
    participantCount: null,
    closeTime: new Date("2026-12-31T00:00:00.000Z"),
    resolutionStatus: ResolutionStatus.OPEN,
    sourceUrl: "https://example.com",
    lastUpdated: new Date("2026-06-23T00:00:00.000Z"),
    observedAt: new Date("2026-06-23T00:00:00.000Z"),
    rawPayload: { id: "source-1" }
  };
}
