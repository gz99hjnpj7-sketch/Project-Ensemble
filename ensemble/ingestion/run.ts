import { IngestionRunStatus, type PrismaClient } from "@prisma/client";
import { seedClusters } from "@/ensemble/config/clusters";
import { recomputeClusterForecast, recomputeClusterForecasts } from "@/ensemble/composite/persist";
import { getEnabledConnectors } from "@/ensemble/connectors/registry";
import type { MarketConnector } from "@/ensemble/connectors/types";
import { prisma as defaultPrisma } from "@/ensemble/db/prisma";
import { matchDeterministically } from "@/ensemble/matching/deterministic";
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
        counters.connectorResults.push({ sourcePlatform: connector.sourcePlatform, fetched: markets.length, errors: [] });
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
