import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ForecastListFilters = {
  category?: string | null;
  confidence?: string | null;
  warningsOnly?: boolean;
  query?: string | null;
};

export async function getForecastList(filters: ForecastListFilters = {}) {
  const clusters = await prisma.forecastCluster.findMany({
    where: {
      category: filters.category && filters.category !== "ALL" ? (filters.category as Prisma.EnumForecastCategoryFilter["equals"]) : undefined,
      title: filters.query ? { contains: filters.query, mode: "insensitive" } : undefined
    },
    include: {
      compositeForecasts: { orderBy: { computedAt: "desc" }, take: 1 },
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
    },
    orderBy: [{ category: "asc" }, { title: "asc" }]
  });

  return clusters
    .map((cluster) => {
      const latest = cluster.markets.length ? cluster.compositeForecasts[0] ?? null : null;
      const warningCount = cluster.markets.reduce((sum, membership) => sum + membership.market.signalWarnings.length, 0);
      const move24h = estimateClusterMove(cluster.markets.map((membership) => membership.market.snapshots));
      return {
        id: cluster.id,
        slug: cluster.slug,
        title: cluster.title,
        category: cluster.category,
        description: cluster.description,
        compositeProbability: latest?.compositeProbability ?? null,
        confidence: latest?.confidence ?? "LOW",
        qualityScore: latest?.qualityScore ?? 0,
        sourceBreakdown: latest?.sourceBreakdown ?? [],
        computedAt: latest?.computedAt ?? null,
        marketCount: cluster.markets.length,
        warningCount,
        move24h
      };
    })
    .filter((forecast) => (filters.confidence && filters.confidence !== "ALL" ? forecast.confidence === filters.confidence : true))
    .filter((forecast) => (filters.warningsOnly ? forecast.warningCount > 0 : true));
}

export async function getForecastDetail(idOrSlug: string) {
  const cluster = await prisma.forecastCluster.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      compositeForecasts: { orderBy: { computedAt: "desc" }, take: 50 },
      markets: {
        include: {
          market: {
            include: {
              snapshots: { orderBy: { observedAt: "asc" }, take: 200 },
              qualityScores: { orderBy: { computedAt: "desc" }, take: 1 },
              signalWarnings: { orderBy: { observedAt: "desc" }, take: 20 }
            }
          }
        }
      }
    }
  });
  if (!cluster) return null;

  return {
    id: cluster.id,
    slug: cluster.slug,
    title: cluster.title,
    category: cluster.category,
    description: cluster.description,
    latestComposite: cluster.compositeForecasts[0] ?? null,
    compositeHistory: [...cluster.compositeForecasts]
      .reverse()
      .map((forecast) => ({
        observedAt: forecast.computedAt.toISOString(),
        probability: forecast.compositeProbability,
        qualityScore: forecast.qualityScore
      })),
    markets: cluster.markets.map((membership) => ({
      id: membership.market.id,
      question: membership.market.question,
      sourcePlatform: membership.market.sourcePlatform,
      probability: membership.market.currentProbability,
      bid: membership.market.bid,
      ask: membership.market.ask,
      volume: membership.market.volume,
      liquidity: membership.market.liquidity,
      sourceUrl: membership.market.sourceUrl,
      quality: membership.market.qualityScores[0] ?? null,
      warnings: membership.market.signalWarnings,
      snapshots: membership.market.snapshots.map((snapshot) => ({
        observedAt: snapshot.observedAt.toISOString(),
        probability: snapshot.currentProbability,
        bid: snapshot.bid,
        ask: snapshot.ask,
        liquidity: snapshot.liquidity,
        volume: snapshot.volume
      }))
    }))
  };
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
