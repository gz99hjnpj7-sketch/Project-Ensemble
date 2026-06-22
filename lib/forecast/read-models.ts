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
      let leader = null;
      if (cluster.markets.length) {
        const top = [...cluster.markets].sort((a, b) => (b.market.currentProbability || 0) - (a.market.currentProbability || 0))[0];
        leader = top.market.question;
      }
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
        move24h,
        leader
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

  const result = {
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
    }))
  };

  // For election-style clusters, group by event and take top 5 by probability per event.
  // This makes 63 markets more concise and sensible (top per race) while showing the spread.
  if (result.slug === "us-presidential-election" && result.markets.length > 5) {
    const byEvent: Record<string, typeof result.markets> = {};
    for (const m of result.markets) {
      const key = m.eventTitle || 'Other';
      if (!byEvent[key]) byEvent[key] = [];
      byEvent[key].push(m);
    }
    let selected: typeof result.markets = [];
    for (const ev of Object.keys(byEvent)) {
      const top = byEvent[ev]
        .sort((a, b) => (b.probability || 0) - (a.probability || 0))
        .slice(0, 5);
      selected.push(...top);
    }
    result.markets = selected.sort((a, b) => (b.probability || 0) - (a.probability || 0));

    if (result.latestComposite?.sourceBreakdown && Array.isArray(result.latestComposite.sourceBreakdown)) {
      (result.latestComposite as any).sourceBreakdown = (result.latestComposite as any).sourceBreakdown
        .sort((a: any, b: any) => (b.probability || 0) - (a.probability || 0))
        .slice(0, 15);
    }
  }

  // Prepare additional series for the chart: top 4 markets' probability histories (for multi-line graph)
  const topForChart = [...result.markets]
    .sort((a, b) => (b.probability || 0) - (a.probability || 0))
    .slice(0, 4);
  (result as any).topMarketSeries = topForChart.map(m => ({
    name: m.question.length > 40 ? m.question.slice(0, 37) + '...' : m.question,
    data: m.snapshots.map(s => ({
      observedAt: s.observedAt,
      probability: s.probability
    }))
  }));

  return result;
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
