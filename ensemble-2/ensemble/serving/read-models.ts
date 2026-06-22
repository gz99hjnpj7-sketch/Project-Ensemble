import type { Prisma } from "@prisma/client";
import { prisma } from "@/ensemble/db/prisma";

export type ForecastListFilters = { category?: string | null; confidence?: string | null; warningsOnly?: boolean; query?: string | null };

export async function getForecastDashboard(filters: ForecastListFilters = {}) {
  const [clusters, unclusteredCount, warningCount, lastRun] = await Promise.all([
    prisma.forecastCluster.findMany({ where: { category: filters.category && filters.category !== "ALL" ? (filters.category as Prisma.EnumForecastCategoryFilter["equals"]) : undefined, title: filters.query ? { contains: filters.query, mode: "insensitive" } : undefined }, include: { current: true, markets: true }, orderBy: [{ category: "asc" }, { title: "asc" }] }),
    prisma.normalizedMarket.count({ where: { clusterMemberships: { none: {} } } }),
    prisma.signalWarning.count(),
    prisma.ingestionRun.findFirst({ orderBy: { startedAt: "desc" } })
  ]);
  const forecasts = clusters.map((cluster) => ({ id: cluster.id, slug: cluster.slug, title: cluster.title, category: cluster.category, description: cluster.description, compositeProbability: cluster.current?.compositeProbability ?? null, confidence: cluster.current?.confidence ?? "LOW", confidenceBand: cluster.current?.confidenceBand ?? "NORMAL", qualityScore: cluster.current?.qualityScore ?? 0, computedAt: cluster.current?.computedAt ?? null, marketCount: cluster.current?.sourceCount ?? cluster.markets.length, warningCount: cluster.current?.warningCount ?? 0, move24h: null }))
    .filter((forecast) => (filters.confidence && filters.confidence !== "ALL" ? forecast.confidence === filters.confidence : true))
    .filter((forecast) => (filters.warningsOnly ? forecast.warningCount > 0 : true));
  return { forecasts, summary: { forecastCount: forecasts.length, clusteredMarketCount: clusters.reduce((sum, cluster) => sum + cluster.markets.length, 0), unclusteredMarketCount: unclusteredCount, warningCount, lastRun: lastRun ? { id: lastRun.id, status: lastRun.status, startedAt: lastRun.startedAt, finishedAt: lastRun.finishedAt } : null } };
}

export async function getForecastList(filters: ForecastListFilters = {}) {
  return (await getForecastDashboard(filters)).forecasts;
}

export async function getForecastDetail(idOrSlug: string) {
  const cluster = await prisma.forecastCluster.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: { current: true, compositeForecasts: { orderBy: { computedAt: "desc" }, take: 50 }, markets: { include: { market: { include: { snapshots: { orderBy: { observedAt: "asc" }, take: 200 }, qualityScores: { orderBy: { computedAt: "desc" }, take: 1 }, signalWarnings: { orderBy: { observedAt: "desc" }, take: 20 }, matchDecisions: { orderBy: { observedAt: "desc" }, take: 1 } } } } } }
  });
  if (!cluster) return null;
  return {
    id: cluster.id,
    slug: cluster.slug,
    title: cluster.title,
    category: cluster.category,
    description: cluster.description,
    current: cluster.current,
    latestComposite: cluster.compositeForecasts[0] ?? null,
    compositeHistory: [...cluster.compositeForecasts].reverse().map((forecast) => ({ observedAt: forecast.computedAt.toISOString(), probability: forecast.compositeProbability, qualityScore: forecast.qualityScore })),
    markets: cluster.markets.map((membership) => ({ id: membership.market.id, question: membership.market.question, eventTitle: membership.market.eventTitle, sourcePlatform: membership.market.sourcePlatform, probability: membership.market.currentProbability, bid: membership.market.bid, ask: membership.market.ask, volume: membership.market.volume, liquidity: membership.market.liquidity, sourceUrl: membership.market.sourceUrl, closeTime: membership.market.closeTime, quality: membership.market.qualityScores[0] ?? null, warnings: membership.market.signalWarnings, latestMatch: membership.market.matchDecisions[0] ?? null, snapshots: membership.market.snapshots.map((snapshot) => ({ observedAt: snapshot.observedAt.toISOString(), probability: snapshot.currentProbability, bid: snapshot.bid, ask: snapshot.ask, liquidity: snapshot.liquidity, volume: snapshot.volume })) })),
    sourceAudit: normalizeSourceBreakdown(cluster.current?.sourceBreakdown ?? cluster.compositeForecasts[0]?.sourceBreakdown ?? null)
  };
}

function normalizeSourceBreakdown(value: unknown): { sources: any[]; policy: any | null } {
  if (!value || typeof value !== "object") return { sources: [], policy: null };
  if (Array.isArray(value)) return { sources: value, policy: null };
  const record = value as { sources?: any[]; policy?: any };
  return { sources: Array.isArray(record.sources) ? record.sources : [], policy: record.policy ?? null };
}
