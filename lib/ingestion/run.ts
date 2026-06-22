import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma, ensureVectorExtension } from "@/lib/db/prisma";
import { getEnabledConnectors } from "@/lib/connectors/registry";
import type { MarketConnector, NormalizedMarketInput } from "@/lib/connectors/types";
import { detectSignalWarnings } from "@/lib/forecast/anomalies";
import { matchingSeedClusters, getMarketEmbedding, discoverSemanticEvents } from "@/lib/forecast/clustering";
import { embedTexts, EMBEDDING_DIM } from "@/lib/embeddings";
import { getClusterEmbedding } from "@/lib/forecast/clustering";
import { computeCompositeForecast } from "@/lib/forecast/composite";
import { computeQualityScore } from "@/lib/forecast/quality";
import { seedClusters } from "@/lib/config/clusters";

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

  await ensureVectorExtension();
  await seedForecastClusters(db);

  const summary: IngestionSummary = {
    connectors: [],
    upsertedMarkets: 0,
    snapshots: 0,
    warnings: 0,
    composites: 0
  };

  for (const connector of connectors) {
    try {
      const markets = await connector.fetchMarkets();
      summary.connectors.push({ sourcePlatform: connector.sourcePlatform, fetched: markets.length, errors: [] });

      // Compute semantic embeddings for ALL fetched markets (this replaces keyword matching entirely)
      const textsForEmbed = markets.map((m) => `${m.question} ${m.eventTitle ?? ""}`.trim());
      let embeddings: number[][] = [];
      try {
        embeddings = await embedTexts(textsForEmbed);
      } catch (e) {
        console.warn("[ingest] Embedding generation failed for batch, falling back to per-item:", (e as Error).message);
        embeddings = await Promise.all(markets.map(async (m) => {
          try { return await getMarketEmbedding(m); } catch { return new Array(EMBEDDING_DIM).fill(0); }
        }));
      }
      markets.forEach((m, i) => { m.embedding = embeddings[i]; });

      for (const market of markets) {
        const result = await persistMarketObservation(db, market, now);
        summary.upsertedMarkets += 1;
        summary.snapshots += 1;
        summary.warnings += result.warningCount;
      }
    } catch (error) {
      summary.connectors.push({
        sourcePlatform: connector.sourcePlatform,
        fetched: 0,
        errors: [error instanceof Error ? error.message : String(error)]
      });
    }
  }

  summary.composites = await recomputeClusterForecasts(db);

  // Dynamic semantic event discovery — the heart of general "gather related markets"
  try {
    const recentWithEmb = await db.normalizedMarket.findMany({
      where: {
        resolutionStatus: { notIn: ["RESOLVED", "CLOSED"] as any },
      },
      select: { id: true, question: true, eventTitle: true, embedding: true },
      take: 400,
      orderBy: { lastUpdated: "desc" }
    });

    const discovered = await discoverSemanticEvents(db, recentWithEmb as any);
    if (discovered > 0) {
      console.log(`[ingest] Discovered and created ${discovered} new semantic event clusters`);
      await recomputeClusterForecasts(db);
    }
  } catch (e) {
    console.warn("[ingest] Dynamic discovery non-fatal error:", (e as Error).message);
  }

  return summary;
}

async function seedForecastClusters(db: PrismaClient): Promise<void> {
  for (const cluster of seedClusters) {
    const rec = await db.forecastCluster.upsert({
      where: { slug: cluster.slug },
      create: {
        slug: cluster.slug,
        title: cluster.title,
        category: cluster.category,
        description: cluster.description
      },
      update: {
        title: cluster.title,
        category: cluster.category,
        description: cluster.description
      }
    });

    // Persist cluster prototype embedding (Float[])
    try {
      const emb = await getClusterEmbedding(cluster);
      if (emb?.length === EMBEDDING_DIM) {
        await db.$executeRaw`
          UPDATE "ForecastCluster" SET embedding = ${JSON.stringify(emb)}::jsonb
          WHERE id = ${rec.id}
        `;
      }
    } catch (e) {
      // non-fatal
    }
  }
}

async function persistMarketObservation(db: PrismaClient, input: NormalizedMarketInput, now: Date): Promise<{ warningCount: number }> {
  const market = await db.normalizedMarket.upsert({
    where: {
      sourcePlatform_sourceMarketId: {
        sourcePlatform: input.sourcePlatform,
        sourceMarketId: input.sourceMarketId
      }
    },
    create: {
      ...input,
      rawPayload: input.rawPayload as object
    },
    update: {
      sourceSlug: input.sourceSlug,
      question: input.question,
      eventTitle: input.eventTitle,
      category: input.category,
      outcomeType: input.outcomeType,
      outcomes: input.outcomes,
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
      rawPayload: input.rawPayload as object
    }
  });

  // Store semantic embedding as native Float[] (simple, no extension needed)
  if (input.embedding && input.embedding.length === EMBEDDING_DIM) {
    try {
      await db.normalizedMarket.update({
        where: { id: market.id },
        data: { embedding: input.embedding as any }
      });
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.warn("[ingest] Failed to store embedding:", (e as Error).message);
    }
  }

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
      rawPayload: input.rawPayload as object
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

  // Pass a clean object for semantic matching (DB row may have Json embedding)
  const marketForAssign = {
    id: market.id,
    sourcePlatform: input.sourcePlatform,
    question: input.question,
    eventTitle: input.eventTitle,
    sourceSlug: input.sourceSlug,
  };
  await assignManualClusters(db, marketForAssign as any, input.embedding);

  const previous24h = await db.marketSnapshot.findFirst({
    where: {
      marketId: market.id,
      observedAt: { lte: new Date(now.getTime() - 23 * 3_600_000) }
    },
    orderBy: { observedAt: "desc" }
  });
  const warnings = detectSignalWarnings(snapshot, previous24h, input.lastUpdated, now);
  if (warnings.length) {
    await db.signalWarning.createMany({
      data: warnings.map((warning) => ({
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

  return { warningCount: warnings.length };
}

async function assignManualClusters(
  db: PrismaClient,
  market: Parameters<typeof matchingSeedClusters>[0] & { id: string },
  providedEmbedding?: number[]
): Promise<void> {
  // Pass embedding through for pure semantic matching (no more keywords)
  const marketForMatch = {
    ...market,
    embedding: providedEmbedding || (market as any).embedding
  };

  const matches = await matchingSeedClusters(marketForMatch as any);

  const seededClusters = await db.forecastCluster.findMany({
    where: { slug: { in: seedClusters.map((cluster) => cluster.slug) } },
    select: { id: true, slug: true }
  });
  const matchedSlugs = new Set(matches.map((match) => match.slug));
  const unmatchedSeededIds = seededClusters.filter((cluster) => !matchedSlugs.has(cluster.slug)).map((cluster) => cluster.id);

  if (unmatchedSeededIds.length) {
    await db.clusterMarket.deleteMany({
      where: {
        marketId: market.id,
        clusterId: { in: unmatchedSeededIds }
      }
    });
  }

  for (const seed of matches) {
    const cluster = await db.forecastCluster.findUnique({ where: { slug: seed.slug } });
    if (!cluster) continue;
    await db.clusterMarket.upsert({
      where: {
        clusterId_marketId: {
          clusterId: cluster.id,
          marketId: market.id
        }
      },
      create: {
        clusterId: cluster.id,
        marketId: market.id,
        sourcePlatform: market.sourcePlatform,
        weightOverride: seed.weightOverride ?? null
      },
      update: {
        sourcePlatform: market.sourcePlatform,
        weightOverride: seed.weightOverride ?? null
      }
    });
  }
}

export async function recomputeClusterForecasts(db: PrismaClient = defaultPrisma): Promise<number> {
  const clusters = await db.forecastCluster.findMany({
    include: {
      markets: {
        include: {
          market: {
            include: {
              qualityScores: {
                orderBy: { computedAt: "desc" },
                take: 1
              }
            }
          }
        }
      }
    }
  });

  let count = 0;
  for (const cluster of clusters) {
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

    if (!cluster.markets.length) continue;
    await db.compositeForecast.create({
      data: {
        clusterId: cluster.id,
        compositeProbability: composite.compositeProbability,
        confidence: composite.confidence,
        qualityScore: composite.qualityScore,
        sourceBreakdown: composite.sourceBreakdown
      }
    });
    count += 1;
  }

  return count;
}
