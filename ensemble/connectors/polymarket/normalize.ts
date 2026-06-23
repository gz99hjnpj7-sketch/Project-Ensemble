import { ForecastCategory, OutcomeType, ResolutionStatus, SourcePlatform } from "@prisma/client";
import type { NormalizedMarketInput } from "@/ensemble/connectors/types";
import type { ClobQuote, GammaMarket } from "./client";

export function getPrimaryTokenId(market: GammaMarket): string | null {
  const outcomes = parseJsonArray<string>(market.outcomes);
  const clobTokenIds = parseJsonArray<string>(market.clobTokenIds);
  const yesIndex = outcomes.findIndex((outcome) => /^yes$/i.test(outcome));
  const primaryIndex = yesIndex >= 0 ? yesIndex : 0;
  return clobTokenIds[primaryIndex] ?? clobTokenIds[0] ?? null;
}

export function normalizePolymarketMarket(market: GammaMarket, options: { clobQuote?: ClobQuote | null; observedAt: Date }): NormalizedMarketInput | null {
  const sourceMarketId = String(market.conditionId ?? market.id ?? "");
  if (!sourceMarketId || !market.question) return null;
  const outcomes = parseJsonArray<string>(market.outcomes);
  const outcomePrices = parseJsonArray<string | number>(market.outcomePrices).map(toNumber);
  const clobTokenIds = parseJsonArray<string>(market.clobTokenIds);
  const yesIndex = outcomes.findIndex((outcome) => /^yes$/i.test(outcome));
  const primaryIndex = yesIndex >= 0 ? yesIndex : 0;
  const bid = options.clobQuote?.bid ?? toNumber(market.bestBid);
  const ask = options.clobQuote?.ask ?? toNumber(market.bestAsk);
  const midpoint = midpointFromBidAsk(bid, ask) ?? toNumber(market.lastTradePrice);
  const fallbackProbability = outcomePrices[primaryIndex] ?? outcomePrices[0] ?? null;
  return {
    sourcePlatform: SourcePlatform.POLYMARKET,
    sourceMarketId,
    sourceSlug: market.slug ?? null,
    question: market.question,
    eventTitle: market.events?.[0]?.title ?? market.question,
    category: inferCategory(market),
    outcomeType: outcomes.length > 2 ? OutcomeType.MULTIPLE_CHOICE : OutcomeType.BINARY,
    outcomes: outcomes.map((name, index) => ({ name, probability: outcomePrices[index] ?? null, tokenId: clobTokenIds[index] ?? null })),
    currentProbability: midpoint ?? fallbackProbability,
    bid,
    ask,
    midpoint,
    volume: toNumber(market.volumeNum ?? market.volume),
    liquidity: toNumber(market.liquidityNum ?? market.liquidity),
    openInterest: null,
    tradeCount: null,
    participantCount: null,
    closeTime: parseDate(market.endDateIso ?? market.endDate),
    resolutionStatus: inferResolutionStatus(market),
    sourceUrl: buildPolymarketSourceUrl(market),
    lastUpdated: parseDate(market.updatedAt) ?? options.observedAt,
    observedAt: options.observedAt,
    rawPayload: { gamma: market, clobQuote: options.clobQuote ?? null }
  };
}

export function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function buildPolymarketSourceUrl(market: Pick<GammaMarket, "slug" | "events">): string | null {
  if (!market.slug) return null;
  const eventSlug = market.events?.[0]?.slug;
  if (!eventSlug || eventSlug === market.slug) return `https://polymarket.com/event/${market.slug}`;
  return `https://polymarket.com/event/${eventSlug}#${market.slug}`;
}

export function midpointFromBidAsk(bid: number | null, ask: number | null): number | null {
  if (bid === null || ask === null) return null;
  return (bid + ask) / 2;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inferResolutionStatus(market: GammaMarket): ResolutionStatus {
  if (market.archived) return ResolutionStatus.CLOSED;
  if (market.closed) return ResolutionStatus.RESOLVED;
  if (market.active) return ResolutionStatus.OPEN;
  return ResolutionStatus.UNKNOWN;
}

export function inferCategory(market: GammaMarket): ForecastCategory {
  const haystack = [
    market.question,
    market.slug,
    ...(market.tags ?? []).map((tag) => (typeof tag === "string" ? tag : `${tag.label ?? ""} ${tag.slug ?? ""}`))
  ].join(" ").toLowerCase();
  if (/(fed|rate|inflation|cpi|gdp|recession|jobs|unemployment|macro|economy)/.test(haystack)) return ForecastCategory.MACRO;
  if (/(election|president|senate|house|trump|biden|congress|politics|primary)/.test(haystack)) return ForecastCategory.POLITICS;
  if (/\b(bitcoin|ethereum|crypto|btc|eth|solana)\b/.test(haystack)) return ForecastCategory.CRYPTO;
  if (/(war|ceasefire|country|minister|nato|world)/.test(haystack)) return ForecastCategory.WORLD;
  return ForecastCategory.OTHER;
}
