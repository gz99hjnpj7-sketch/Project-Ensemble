import type { PrismaClient } from "@prisma/client";
import { matchMarketToSeedCluster, type MatchableMarket } from "@/lib/processing/matcher";

export { matchMarketToSeedCluster } from "@/lib/processing/matcher";

export async function matchingSeedClusters(market: MatchableMarket) {
  const match = matchMarketToSeedCluster(market);
  return match ? [match] : [];
}

export async function discoverSemanticEvents(): Promise<number> {
  return 0;
}

export async function assignDeterministicCluster(
  db: PrismaClient,
  market: MatchableMarket & { id: string }
): Promise<string | null> {
  const match = matchMarketToSeedCluster(market);
  if (!match) return null;

  const cluster = await db.forecastCluster.findUnique({
    where: { slug: match.slug },
    select: { id: true }
  });
  if (!cluster) return null;

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
      relationship: "deterministic",
      weightOverride: match.weightOverride ?? null
    },
    update: {
      sourcePlatform: market.sourcePlatform,
      relationship: "deterministic",
      weightOverride: match.weightOverride ?? null
    }
  });

  return cluster.id;
}
