import type { Prisma } from "@prisma/client";
import { prisma } from "@/ensemble/db/prisma";
import { generateFutureNewsHeadline } from "@/ensemble/news/headlines";

export type ForecastListFilters = { category?: string | null; confidence?: string | null; warningsOnly?: boolean; query?: string | null };

export async function getForecastDashboard(filters: ForecastListFilters = {}) {
  const [clusters, unclusteredCount, warningCount, lastRun] = await Promise.all([
    prisma.forecastCluster.findMany({
      where: { category: filters.category && filters.category !== "ALL" ? (filters.category as Prisma.EnumForecastCategoryFilter["equals"]) : undefined, title: filters.query ? { contains: filters.query, mode: "insensitive" } : undefined },
      include: {
        current: true,
        _count: { select: { markets: true } },
        compositeForecasts: {
          orderBy: { computedAt: "desc" },
          take: 80,
          select: { computedAt: true, compositeProbability: true, sourceBreakdown: true }
        }
      },
      orderBy: [{ category: "asc" }, { title: "asc" }]
    }),
    prisma.normalizedMarket.count({ where: { clusterMemberships: { none: {} } } }),
    prisma.signalWarning.count(),
    prisma.ingestionRun.findFirst({ orderBy: { startedAt: "desc" } })
  ]);
  const forecasts = clusters.map((cluster) => {
    const sourceAudit = normalizeSourceBreakdown(cluster.current?.sourceBreakdown ?? null);
    const comparableForecasts = comparableCompositeForecasts(cluster.compositeForecasts, sourceAudit.algorithmVersion);
    const history = [...comparableForecasts].reverse().map((forecast) => ({ observedAt: forecast.computedAt, probability: forecast.compositeProbability }));
    const movement = computeMovement(history);
    const compositeProbability = cluster.current?.compositeProbability ?? null;
    const futureNews = generateFutureNewsHeadline({ slug: cluster.slug, title: cluster.title, probability: compositeProbability, movement, outcomeBreakdown: sourceAudit.outcomeBreakdown, sources: sourceAudit.sources });
    return { id: cluster.id, slug: cluster.slug, title: cluster.title, category: cluster.category, description: cluster.description, compositeProbability, confidence: cluster.current?.confidence ?? "LOW", confidenceBand: cluster.current?.confidenceBand ?? "NORMAL", qualityScore: cluster.current?.qualityScore ?? 0, computedAt: cluster.current?.computedAt ?? null, marketCount: cluster.current?.sourceCount ?? cluster._count.markets, warningCount: cluster.current?.warningCount ?? 0, sources: sourceAudit.sources, policy: sourceAudit.policy, outcomeBreakdown: sourceAudit.outcomeBreakdown, movement, futureNews };
  })
    .filter((forecast) => (filters.confidence && filters.confidence !== "ALL" ? forecast.confidence === filters.confidence : true))
    .filter((forecast) => (filters.warningsOnly ? forecast.warningCount > 0 : true));
  return { forecasts, summary: { forecastCount: forecasts.length, clusteredMarketCount: clusters.reduce((sum, cluster) => sum + cluster._count.markets, 0), unclusteredMarketCount: unclusteredCount, warningCount, lastRun: lastRun ? { id: lastRun.id, status: lastRun.status, startedAt: lastRun.startedAt, finishedAt: lastRun.finishedAt } : null } };
}

export async function getForecastList(filters: ForecastListFilters = {}) {
  return (await getForecastDashboard(filters)).forecasts;
}

export async function getForecastDetail(idOrSlug: string) {
  const cluster = await prisma.forecastCluster.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: { current: true, compositeForecasts: { orderBy: { computedAt: "desc" }, take: 120 }, markets: { include: { market: { include: { snapshots: { orderBy: { observedAt: "desc" }, take: 80 }, qualityScores: { orderBy: { computedAt: "desc" }, take: 1 }, signalWarnings: { orderBy: { observedAt: "desc" }, take: 20 }, matchDecisions: { orderBy: { observedAt: "desc" }, take: 1 } } } } } }
  });
  if (!cluster) return null;
  const sourceAudit = normalizeSourceBreakdown(cluster.current?.sourceBreakdown ?? cluster.compositeForecasts[0]?.sourceBreakdown ?? null);
  const comparableForecasts = comparableCompositeForecasts(cluster.compositeForecasts, sourceAudit.algorithmVersion);
  const movement = computeMovement([...comparableForecasts].reverse().map((forecast) => ({ observedAt: forecast.computedAt, probability: forecast.compositeProbability })));
  return {
    id: cluster.id,
    slug: cluster.slug,
    title: cluster.title,
    category: cluster.category,
    description: cluster.description,
    current: cluster.current,
    latestComposite: cluster.compositeForecasts[0] ?? null,
    compositeHistory: [...comparableForecasts].reverse().map((forecast) => ({ observedAt: forecast.computedAt.toISOString(), probability: forecast.compositeProbability, qualityScore: forecast.qualityScore })),
    movement,
    markets: cluster.markets.map((membership) => ({ id: membership.market.id, question: membership.market.question, eventTitle: membership.market.eventTitle, sourcePlatform: membership.market.sourcePlatform, probability: membership.market.currentProbability, bid: membership.market.bid, ask: membership.market.ask, volume: membership.market.volume, liquidity: membership.market.liquidity, sourceUrl: membership.market.sourceUrl, closeTime: membership.market.closeTime, quality: membership.market.qualityScores[0] ?? null, warnings: membership.market.signalWarnings, latestMatch: membership.market.matchDecisions[0] ?? null, snapshots: [...membership.market.snapshots].reverse().map((snapshot) => ({ observedAt: snapshot.observedAt.toISOString(), probability: snapshot.currentProbability, bid: snapshot.bid, ask: snapshot.ask, liquidity: snapshot.liquidity, volume: snapshot.volume })) })),
    sourceAudit,
    futureNews: generateFutureNewsHeadline({
      slug: cluster.slug,
      title: cluster.title,
      probability: cluster.current?.compositeProbability ?? null,
      movement,
      outcomeBreakdown: sourceAudit.outcomeBreakdown,
      sources: sourceAudit.sources
    })
  };
}

type MovementPoint = { observedAt: Date; probability: number | null };

function computeMovement(history: MovementPoint[]) {
  const usable = history.filter((point): point is { observedAt: Date; probability: number } => typeof point.probability === "number");
  const latest = usable.at(-1) ?? null;
  if (!latest) return { previousRun: null, sinceFirst: null, day: null, week: null, pointCount: 0 };
  return {
    previousRun: movementFromPoint(latest, usable.at(-2) ?? null),
    sinceFirst: movementFromPoint(latest, usable[0] ?? null),
    day: movementFromPoint(latest, closestAtOrBefore(usable, new Date(latest.observedAt.getTime() - 24 * 3_600_000))),
    week: movementFromPoint(latest, closestAtOrBefore(usable, new Date(latest.observedAt.getTime() - 7 * 24 * 3_600_000))),
    pointCount: usable.length
  };
}

function movementFromPoint(latest: { observedAt: Date; probability: number }, previous: { observedAt: Date; probability: number } | null) {
  if (!previous || previous.observedAt.getTime() === latest.observedAt.getTime()) return null;
  return {
    from: previous.observedAt.toISOString(),
    to: latest.observedAt.toISOString(),
    probability: latest.probability - previous.probability
  };
}

function closestAtOrBefore(points: Array<{ observedAt: Date; probability: number }>, target: Date) {
  const eligible = points.filter((point) => point.observedAt <= target);
  return eligible.at(-1) ?? null;
}

function comparableCompositeForecasts<T extends { sourceBreakdown: unknown }>(forecasts: T[], algorithmVersion: string | null): T[] {
  if (!algorithmVersion) return forecasts;
  return forecasts.filter((forecast) => normalizeSourceBreakdown(forecast.sourceBreakdown).algorithmVersion === algorithmVersion);
}

function normalizeSourceBreakdown(value: unknown): { algorithmVersion: string | null; sources: any[]; policy: any | null; outcomeBreakdown: any[] | null } {
  if (!value || typeof value !== "object") return { algorithmVersion: null, sources: [], policy: null, outcomeBreakdown: null };
  if (Array.isArray(value)) return { algorithmVersion: null, sources: value, policy: null, outcomeBreakdown: null };
  const record = value as { algorithmVersion?: string | null; sources?: any[]; policy?: any; outcomeBreakdown?: any[] | null };
  return { algorithmVersion: record.algorithmVersion ?? null, sources: Array.isArray(record.sources) ? record.sources : [], policy: record.policy ?? null, outcomeBreakdown: Array.isArray(record.outcomeBreakdown) ? record.outcomeBreakdown : null };
}
