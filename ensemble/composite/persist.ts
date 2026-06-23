import type { PrismaClient } from "@prisma/client";
import { seedClusters } from "@/ensemble/config/clusters";
import { prisma as defaultPrisma } from "@/ensemble/db/prisma";
import { computeCompositeForecast } from "./compute";

const COMPOSITE_ALGORITHM_VERSION = "2026-06-23-headline-source-roles-v2";

export async function recomputeClusterForecasts(db: PrismaClient = defaultPrisma): Promise<number> {
  const clusters = await db.forecastCluster.findMany({ select: { id: true } });
  let count = 0;
  for (const cluster of clusters) if (await recomputeClusterForecast(db, cluster.id)) count += 1;
  return count;
}

export async function recomputeClusterForecast(db: PrismaClient, clusterId: string): Promise<boolean> {
  const cluster = await db.forecastCluster.findUnique({
    where: { id: clusterId },
    include: { markets: { include: { market: { include: { qualityScores: { orderBy: { computedAt: "desc" }, take: 1 }, signalWarnings: { orderBy: { observedAt: "desc" }, take: 10 } } } } } }
  });
  if (!cluster || !cluster.markets.length) return false;
  const seedCluster = seedClusters.find((seed) => seed.slug === cluster.slug);
  const composite = computeCompositeForecast(cluster.markets.map((membership) => {
    const latestQuality = membership.market.qualityScores[0];
    return {
      marketId: membership.market.id,
      sourcePlatform: membership.market.sourcePlatform,
      question: membership.market.question,
      eventTitle: membership.market.eventTitle,
      sourceUrl: membership.market.sourceUrl,
      probability: membership.market.currentProbability,
      outcomes: membership.market.outcomes as Array<{ name: string; probability?: number | null }>,
      qualityScore: latestQuality?.score ?? 0,
      recencyScore: latestQuality?.recencyScore ?? 0,
      resolutionStatus: membership.market.resolutionStatus,
      warnings: membership.market.signalWarnings.map((warning) => ({ type: warning.type })),
      weightOverride: membership.weightOverride,
      requiresInversion: membership.requiresInversion
    };
  }), { targetMetric: seedCluster?.rule.targetMetric });
  const payload = { algorithmVersion: COMPOSITE_ALGORITHM_VERSION, sources: composite.sourceBreakdown, policy: composite.policy, outcomeBreakdown: composite.outcomeBreakdown ?? null };
  const headlineSourceCount = composite.sourceBreakdown.filter((source) => source.included).length;
  const warningCount = composite.sourceBreakdown.reduce((sum, source) => sum + source.warnings.length, 0);
  const created = await db.compositeForecast.create({
    data: { clusterId: cluster.id, compositeProbability: composite.compositeProbability, confidence: composite.confidence, confidenceBand: composite.policy.confidenceBand.toUpperCase() as any, qualityScore: composite.qualityScore, sourceBreakdown: payload }
  });
  await db.forecastCurrent.upsert({
    where: { clusterId: cluster.id },
    create: { clusterId: cluster.id, latestCompositeId: created.id, compositeProbability: composite.compositeProbability, confidence: composite.confidence, confidenceBand: composite.policy.confidenceBand.toUpperCase() as any, qualityScore: composite.qualityScore, sourceCount: headlineSourceCount, warningCount, sourceBreakdown: payload, policy: composite.policy, computedAt: created.computedAt },
    update: { latestCompositeId: created.id, compositeProbability: composite.compositeProbability, confidence: composite.confidence, confidenceBand: composite.policy.confidenceBand.toUpperCase() as any, qualityScore: composite.qualityScore, sourceCount: headlineSourceCount, warningCount, sourceBreakdown: payload, policy: composite.policy, computedAt: created.computedAt }
  });
  return true;
}
