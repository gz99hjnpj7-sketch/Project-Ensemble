import type { Prisma, PrismaClient } from "@prisma/client";
import { IngestionRunStatus, ResolutionStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db/prisma";
import { getEnabledConnectors } from "@/lib/connectors/registry";
import type { MarketConnector, NormalizedMarketInput } from "@/lib/connectors/types";
import { seedClusters } from "@/lib/config/clusters";
import { detectSignalWarnings } from "@/lib/forecast/anomalies";
import { computeCompositeForecast } from "@/lib/forecast/composite";
import { computeQualityScore } from "@/lib/forecast/quality";
import { assignDeterministicCluster } from "@/lib/forecast/clustering";
import { buildForecastCurrentPayload, writeForecastCurrent } from "@/lib/processing/cache";

export type IngestionSummary = {
  connectors: Array<{ sourcePlatform: string; fetched: number; errors: string[] }>;
  upsertedMarkets: number;
  snapshots: number;
  warnings: number;
  composites: number;
};

export async function runIngestion(options: {
  prisma?: PrismaClient;
  connectors?: MarketConnector[];
  now?: Date;
} = {}): Promise<IngestionSummary> {
  const db = options.prisma ?? defaultPrisma;
  const connectors = options.connectors ?? getEnabledConnectors();
  const now = options.now ?? new Date();

  await seedForecastClusters(db);

  const summary: IngestionSummary = {
    connectors: [],
    upsertedMarkets: 0,
    snapshots: 0,
    warnings: 0,
    composites: 0
  };

  for (const connector of connectors) {
    const run = await db.ingestionRun.create({
      data: {
        sourcePlatform: connector.sourcePlatform,
        status: IngestionRunStatus.RUNNING,
        errors: []
      }
    });

    let fetched = 0;
    let upserted = 0;
    let snapshots = 0;
    let warnings = 0;
    const errors: string[] = [];

    try {
      const markets = await connector.fetchMarkets();
      fetched = markets.length;

      for (const market of markets) {
        const result = await persistMarketObservation(db, market, now);
        upserted += 1;
        snapshots += 1;
        warnings += result.warningCount;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    await db.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: errors.length ? IngestionRunStatus.FAILED : IngestionRunStatus.SUCCESS,
        fetchedCount: fetched,
        upsertedCount: upserted,
        snapshotCount: snapshots,
        warningCount: warnings,
        errors,
        completedAt: new Date()
      }
    });

    summary.connectors.push({ sourcePlatform: connector.sourcePlatform, fetched, errors });
    summary.upsertedMarkets += upserted;
    summary.snapshots += snapshots;
    summary.warnings += warnings;
  }

  summary.composites = await recomputeClusterForecasts(db, now);

  return summary;
}

async function seedForecastClusters(db: PrismaClient): Promise<void> {
  for (const cluster of seedClusters) {
    await db.forecastCluster.upsert({
      where: { slug: cluster.slug },
      create: {
        slug: cluster.slug,
        title: cluster.title,
        category: cluster.category,
        description: cluster.description,
        isSeed: true
      },
      update: {
        title: cluster.title,
        category: cluster.category,
        description: cluster.description,
        isSeed: true
      }
    });
  }
}

async function persistMarketObservation(
  db: PrismaClient,
  input: NormalizedMarketInput,
  now: Date
): Promise<{ warningCount: number }> {
  const sourceId = input.sourceMarketId;
  const market = await db.normalizedMarket.upsert({
    where: {
      sourcePlatform_sourceId: {
        sourcePlatform: input.sourcePlatform,
        sourceId
      }
    },
    create: {
      ...marketData(input),
      sourceId
    },
    update: marketData(input)
  });

  const snapshot = await db.marketSnapshot.create({
    data: {
      marketId: market.id,
      sourcePlatform: input.sourcePlatform,
      observedAt: now,
      currentProbability: input.currentProbability,
      bid: input.bid,
      ask: input.ask,
      midpoint: input.midpoint,
      volume: input.volume,
      liquidity: input.liquidity,
      openInterest: input.openInterest,
      tradeCount: input.tradeCount,
      participantCount: input.participantCount,
      rawPayload: input.rawPayload as Prisma.InputJsonValue
    }
  });

  const quality = computeQualityScore({ ...input, createdAt: market.createdAt }, now);
  await db.marketQualityScore.create({
    data: {
      marketId: market.id,
      score: quality.score,
      confidence: quality.confidence,
      flags: quality.flags,
      liquidityScore: quality.liquidityScore,
      spreadScore: quality.spreadScore,
      volumeScore: quality.volumeScore,
      recencyScore: quality.recencyScore,
      marketAgeScore: quality.marketAgeScore,
      computedAt: now
    }
  });

  if (input.resolutionStatus === ResolutionStatus.OPEN && input.currentProbability !== null && input.currentProbability !== undefined) {
    await assignDeterministicCluster(db, {
      id: market.id,
      sourcePlatform: input.sourcePlatform,
      question: input.question,
      eventTitle: input.eventTitle,
      sourceSlug: input.sourceSlug,
      category: input.category
    });
  }

  const previous24h = await db.marketSnapshot.findFirst({
    where: {
      marketId: market.id,
      observedAt: { lte: new Date(now.getTime() - 23 * 3_600_000) }
    },
    orderBy: { observedAt: "desc" }
  });
  const warningInputs = detectSignalWarnings(snapshot, previous24h, input.lastUpdated, now);
  if (warningInputs.length) {
    await db.signalWarning.createMany({
      data: warningInputs.map((warning) => ({
        marketId: market.id,
        sourcePlatform: input.sourcePlatform,
        type: warning.type,
        message: warning.message,
        severity: warning.severity,
        observedAt: now,
        metadata: warning.metadata as Prisma.InputJsonValue
      }))
    });
  }

  return { warningCount: warningInputs.length };
}

function marketData(input: NormalizedMarketInput) {
  return {
    sourcePlatform: input.sourcePlatform,
    sourceMarketId: input.sourceMarketId,
    sourceSlug: input.sourceSlug,
    question: input.question,
    marketType: input.outcomeType,
    eventTitle: input.eventTitle,
    category: input.category,
    outcomeType: input.outcomeType,
    outcomes: input.outcomes as Prisma.InputJsonValue,
    currentProbability: input.currentProbability,
    bid: input.bid,
    ask: input.ask,
    midpoint: input.midpoint,
    volume: input.volume,
    liquidity: input.liquidity,
    openInterest: input.openInterest,
    tradeCount: input.tradeCount,
    participantCount: input.participantCount,
    closeTime: input.closeTime,
    resolutionStatus: input.resolutionStatus,
    sourceUrl: input.sourceUrl,
    lastUpdated: input.lastUpdated,
    rawPayload: input.rawPayload as Prisma.InputJsonValue
  };
}

export async function recomputeClusterForecasts(
  db: PrismaClient = defaultPrisma,
  processedAt = new Date()
): Promise<number> {
  const clusters = await db.forecastCluster.findMany({
    include: {
      markets: {
        include: {
          market: {
            include: {
              snapshots: { orderBy: { observedAt: "desc" }, take: 2 },
              signalWarnings: { orderBy: { observedAt: "desc" }, take: 10 },
              qualityScores: { orderBy: { computedAt: "desc" }, take: 1 }
            }
          }
        }
      }
    }
  });

  let count = 0;
  for (const cluster of clusters) {
    if (!cluster.markets.length) continue;

    const composite = computeCompositeForecast(
      cluster.markets.map((membership) => {
        const latestQuality = membership.market.qualityScores[0];
        return {
          marketId: membership.market.id,
          sourcePlatform: membership.market.sourcePlatform,
          question: membership.market.question,
          probability: membership.market.currentProbability,
          qualityScore: latestQuality?.score ?? 0,
          recencyScore: latestQuality?.recencyScore ?? 0,
          weightOverride: membership.weightOverride
        };
      })
    );

    await db.compositeForecast.create({
      data: {
        clusterId: cluster.id,
        compositeValue: composite.compositeProbability,
        confidenceScore: composite.qualityScore,
        sourceBreakdown: composite.sourceBreakdown as Prisma.InputJsonValue,
        createdAt: processedAt
      }
    });

    await writeForecastCurrent(
      db,
      buildForecastCurrentPayload({
        clusterId: cluster.id,
        composite,
        marketCount: cluster.markets.length,
        warningCount: cluster.markets.reduce((sum, membership) => sum + membership.market.signalWarnings.length, 0),
        move24h: estimateClusterMove(cluster.markets.map((membership) => membership.market.snapshots)),
        processedAt
      })
    );

    count += 1;
  }

  return count;
}

function estimateClusterMove(snapshotsByMarket: Array<Array<{ currentProbability: number | null }>>): number | null {
  const deltas = snapshotsByMarket
    .map((snapshots) => {
      const latest = snapshots[0]?.currentProbability;
      const previous = snapshots[1]?.currentProbability;
      return latest !== null && latest !== undefined && previous !== null && previous !== undefined ? latest - previous : null;
    })
    .filter((delta): delta is number => delta !== null);

  if (!deltas.length) return null;
  return deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
}
