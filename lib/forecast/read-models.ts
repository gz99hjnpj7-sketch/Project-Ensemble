import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ForecastListFilters = {
  category?: string | null;
  confidence?: string | null;
  warningsOnly?: boolean;
  query?: string | null;
};

export async function getForecastList(filters: ForecastListFilters = {}) {
  const currents = await prisma.forecastCurrent.findMany({
    where: {
      confidence: filters.confidence && filters.confidence !== "ALL" ? (filters.confidence as Prisma.EnumSignalConfidenceFilter["equals"]) : undefined,
      warningCount: filters.warningsOnly ? { gt: 0 } : undefined,
      cluster: {
        category: filters.category && filters.category !== "ALL" ? (filters.category as Prisma.EnumForecastCategoryFilter["equals"]) : undefined,
        title: filters.query ? { contains: filters.query, mode: "insensitive" } : undefined
      }
    },
    include: {
      cluster: true
    },
    orderBy: [{ marketCount: "desc" }, { compositeValue: "desc" }, { processedAt: "desc" }]
  });

  return currents.map((current) => ({
    id: current.cluster.id,
    slug: current.cluster.slug,
    title: current.cluster.title,
    category: current.cluster.category,
    description: current.cluster.description,
    compositeProbability: current.compositeValue,
    confidence: current.confidence,
    qualityScore: current.confidenceScore,
    sourceBreakdown: current.sourceBreakdown,
    computedAt: current.processedAt,
    marketCount: current.marketCount,
    warningCount: current.warningCount,
    move24h: current.move24h
  }));
}

export async function getForecastDetail(idOrSlug: string) {
  const cluster = await prisma.forecastCluster.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      currentForecast: true,
      compositeForecasts: { orderBy: { createdAt: "desc" }, take: 50 },
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
    current: cluster.currentForecast,
    latestComposite: cluster.compositeForecasts[0] ?? null,
    compositeHistory: [...cluster.compositeForecasts]
      .reverse()
      .map((forecast) => ({
        observedAt: forecast.createdAt.toISOString(),
        probability: forecast.compositeValue,
        qualityScore: forecast.confidenceScore ?? 0
      })),
    markets: cluster.markets.map((membership) => ({
      id: membership.market.id,
      question: membership.market.question,
      eventTitle: membership.market.eventTitle,
      sourcePlatform: membership.market.sourcePlatform,
      probability: membership.market.currentProbability,
      bid: membership.market.bid,
      ask: membership.market.ask,
      volume: membership.market.volume,
      liquidity: membership.market.liquidity,
      sourceUrl: membership.market.sourceUrl,
      closeTime: membership.market.closeTime,
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
    })),
    topMarketSeries: cluster.markets
      .map((membership) => membership.market)
      .sort((a, b) => (b.currentProbability || 0) - (a.currentProbability || 0))
      .slice(0, 4)
      .map((market) => ({
        name: market.question.length > 40 ? market.question.slice(0, 37) + "..." : market.question,
        data: market.snapshots.map((snapshot) => ({
          observedAt: snapshot.observedAt.toISOString(),
          probability: snapshot.currentProbability
        }))
      }))
  };
}
