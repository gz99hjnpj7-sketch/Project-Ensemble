import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/ensemble/db/prisma";
import { computeCompositeForecast } from "./compute";

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
  const composite = computeCompositeForecast(cluster.markets.map((membership) => {
    const latestQuality = membership.market.qualityScores[0];
    return {
      marketId: membership.market.id,
      sourcePlatform: membership.market.sourcePlatform,
      question: membership.market.question,
      probability: membership.market.currentProbability,
      qualityScore: latestQuality?.score ?? 0,
      recencyScore: latestQuality?.recencyScore ?? 0,
      resolutionStatus: membership.market.resolutionStatus,
      warnings: membership.market.signalWarnings.map((warning) => ({ type: warning.type })),
      weightOverride: membership.weightOverride
    };
  }));
  const payload = { sources: composite.sourceBreakdown, policy: composite.policy };
  const created = await db.compositeForecast.create({
    data: { clusterId: cluster.id, compositeProbability: composite.compositeProbability, confidence: composite.confidence, confidenceBand: composite.policy.confidenceBand.toUpperCase() as any, qualityScore: composite.qualityScore, sourceBreakdown: payload }
  });
  await db.forecastCurrent.upsert({
    where: { clusterId: cluster.id },
    create: { clusterId: cluster.id, latestCompositeId: created.id, compositeProbability: composite.compositeProbability, confidence: composite.confidence, confidenceBand: composite.policy.confidenceBand.toUpperCase() as any, qualityScore: composite.qualityScore, sourceCount: composite.policy.includedMarketIds.length, warningCount: composite.sourceBreakdown.reduce((sum, source) => sum + source.warnings.length, 0), sourceBreakdown: payload, policy: composite.policy, computedAt: created.computedAt },
    update: { latestCompositeId: created.id, compositeProbability: composite.compositeProbability, confidence: composite.confidence, confidenceBand: composite.policy.confidenceBand.toUpperCase() as any, qualityScore: composite.qualityScore, sourceCount: composite.policy.includedMarketIds.length, warningCount: composite.sourceBreakdown.reduce((sum, source) => sum + source.warnings.length, 0), sourceBreakdown: payload, policy: composite.policy, computedAt: created.computedAt }
  });
  return true;
}
