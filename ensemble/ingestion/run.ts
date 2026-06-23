import { IngestionRunStatus, MatchOutcome, ResolutionStatus, type PrismaClient } from "@prisma/client";
import { seedClusters } from "@/ensemble/config/clusters";
import { recomputeClusterForecast, recomputeClusterForecasts } from "@/ensemble/composite/persist";
import { getEnabledConnectors } from "@/ensemble/connectors/registry";
import type { MarketConnector } from "@/ensemble/connectors/types";
import { prisma as defaultPrisma } from "@/ensemble/db/prisma";
import { matchDeterministically } from "@/ensemble/matching/deterministic";
import { toPrismaMatchMethod } from "@/ensemble/matching/types";
import { createIngestionRun, finishIngestionRun, type IngestionCounters } from "./ingestion-run-log";
import { persistMarketObservation } from "./persist";

export type IngestionSummary = IngestionCounters & { runId: string; status: IngestionRunStatus };

export async function runIngestion(options: { prisma?: PrismaClient; connectors?: MarketConnector[]; now?: Date } = {}): Promise<IngestionSummary> {
  const db = options.prisma ?? defaultPrisma;
  const connectors = options.connectors ?? getEnabledConnectors();
  const now = options.now ?? new Date();
  const run = await createIngestionRun(db);
  const counters: IngestionCounters = { connectorResults: [], errors: [], marketsFetched: 0, marketsUpserted: 0, snapshotsWritten: 0, matchDecisionsWritten: 0, compositesUpdated: 0, warningsWritten: 0 };
  const affectedClusterIds = new Set<string>();
  try {
    await seedForecastClusters(db);
    await resetSeedClusterOutputs(db);
    const clusters = await db.forecastCluster.findMany();
    for (const connector of connectors) {
      try {
        const markets = await connector.fetchMarkets(now);
        const diagnostics = connector.getDiagnostics?.() ?? { errors: [] };
        counters.connectorResults.push({ sourcePlatform: connector.sourcePlatform, fetched: markets.length, errors: diagnostics.errors });
        counters.errors.push(...diagnostics.errors.map((error) => `${connector.sourcePlatform}: ${error}`));
        counters.marketsFetched += markets.length;
        for (const market of markets) {
          const match = matchDeterministically(market as any, clusters);
          const result = await persistMarketObservation(db, market, run.id, match, now);
          counters.marketsUpserted += 1;
          counters.snapshotsWritten += 1;
          counters.matchDecisionsWritten += 1;
          counters.warningsWritten += result.warningCount;
          if (result.matchedClusterId) affectedClusterIds.add(result.matchedClusterId);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        counters.connectorResults.push({ sourcePlatform: connector.sourcePlatform, fetched: 0, errors: [message] });
        counters.errors.push(`${connector.sourcePlatform}: ${message}`);
      }
    }
    const rematch = await rebuildClusterMemberships(db, clusters, run.id, now);
    counters.matchDecisionsWritten += rematch.matchDecisionsWritten;
    for (const clusterId of rematch.affectedClusterIds) affectedClusterIds.add(clusterId);
    for (const clusterId of affectedClusterIds) {
      if (await recomputeClusterForecast(db, clusterId)) counters.compositesUpdated += 1;
    }
    if (affectedClusterIds.size === 0) counters.compositesUpdated = await recomputeClusterForecasts(db);
    const status = counters.errors.length ? IngestionRunStatus.PARTIAL : IngestionRunStatus.SUCCEEDED;
    await finishIngestionRun(db, run.id, counters, status);
    return { ...counters, runId: run.id, status };
  } catch (error) {
    counters.errors.push(error instanceof Error ? error.message : String(error));
    await finishIngestionRun(db, run.id, counters, IngestionRunStatus.FAILED);
    return { ...counters, runId: run.id, status: IngestionRunStatus.FAILED };
  }
}

async function seedForecastClusters(db: PrismaClient): Promise<void> {
  const activeSlugs = seedClusters.map((cluster) => cluster.slug);
  await db.forecastCluster.deleteMany({ where: { slug: { notIn: activeSlugs } } });
  for (const cluster of seedClusters) {
    await db.forecastCluster.upsert({ where: { slug: cluster.slug }, create: { slug: cluster.slug, title: cluster.title, category: cluster.category, description: cluster.description }, update: { title: cluster.title, category: cluster.category, description: cluster.description } });
  }
}

async function resetSeedClusterOutputs(db: PrismaClient): Promise<void> {
  await db.forecastCurrent.deleteMany();
  await db.clusterMarket.deleteMany();
}

async function rebuildClusterMemberships(db: PrismaClient, clusters: Awaited<ReturnType<PrismaClient["forecastCluster"]["findMany"]>>, runId: string, now: Date) {
  await db.clusterMarket.deleteMany();
  const affectedClusterIds = new Set<string>();
  let matchDecisionsWritten = 0;
  const markets = await db.normalizedMarket.findMany({ where: { resolutionStatus: ResolutionStatus.OPEN } });
  for (const market of markets) {
    const match = matchDeterministically(market, clusters);
    await db.matchDecision.create({
      data: {
        marketId: market.id,
        clusterId: match.kind === "matched" ? match.clusterId : null,
        outcome: match.kind === "matched" ? MatchOutcome.MATCHED : MatchOutcome.UNMATCHED,
        method: toPrismaMatchMethod(match.method),
        confidence: match.confidence,
        reason: `${match.reason} / rematched after ingestion ${runId}`,
        observedAt: now
      }
    });
    matchDecisionsWritten += 1;
    if (match.kind === "matched") {
      affectedClusterIds.add(match.clusterId);
      await db.clusterMarket.upsert({
        where: { clusterId_marketId: { clusterId: match.clusterId, marketId: market.id } },
        create: { clusterId: match.clusterId, marketId: market.id, sourcePlatform: market.sourcePlatform, relationship: match.method, requiresInversion: match.requiresInversion ?? false },
        update: { sourcePlatform: market.sourcePlatform, relationship: match.method, requiresInversion: match.requiresInversion ?? false }
      });
    }
  }
  return { affectedClusterIds, matchDecisionsWritten };
}
