import {
  ForecastCategory,
  OutcomeType,
  ResolutionStatus,
  SourcePlatform
} from "@prisma/client";
import type { MarketConnector, NormalizedMarketInput } from "./types";

type GammaMarket = {
  id?: string | number;
  conditionId?: string;
  question?: string;
  slug?: string;
  volume?: string | number;
  volumeNum?: string | number;
  liquidity?: string | number;
  liquidityNum?: string | number;
  closed?: boolean;
  archived?: boolean;
  active?: boolean;
  endDate?: string;
  endDateIso?: string;
  updatedAt?: string;
  createdAt?: string;
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  clobTokenIds?: string | string[];
  bestBid?: string | number;
  bestAsk?: string | number;
  lastTradePrice?: string | number;
  enableOrderBook?: boolean;
  tags?: Array<{ label?: string; slug?: string }> | string[];
  events?: Array<{ title?: string; slug?: string }>;
};

type ClobBook = {
  bids?: Array<{ price?: string; size?: string }>;
  asks?: Array<{ price?: string; size?: string }>;
};

const DEFAULT_GAMMA_URL = "https://gamma-api.polymarket.com";
const DEFAULT_CLOB_URL = "https://clob.polymarket.com";

export class PolymarketConnector implements MarketConnector {
  sourcePlatform = SourcePlatform.POLYMARKET;

  private gammaUrl = process.env.POLYMARKET_GAMMA_URL ?? DEFAULT_GAMMA_URL;
  private clobUrl = process.env.POLYMARKET_CLOB_URL ?? DEFAULT_CLOB_URL;
  private marketLimit = Number(process.env.INGEST_MARKET_LIMIT ?? 80);

  async fetchMarkets(): Promise<NormalizedMarketInput[]> {
    const markets = await this.fetchGammaMarkets();
    const normalized = await Promise.all(markets.map((market) => this.normalizeMarket(market)));
    return normalized.filter((market): market is NormalizedMarketInput => Boolean(market));
  }

  private async fetchGammaMarkets(): Promise<GammaMarket[]> {
    const url = new URL("/markets", this.gammaUrl);
    url.searchParams.set("limit", String(this.marketLimit));
    url.searchParams.set("active", "true");
    url.searchParams.set("closed", "false");
    url.searchParams.set("order", "volumeNum");
    url.searchParams.set("ascending", "false");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Polymarket Gamma request failed: ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload : payload.markets ?? [];
  }

  private async normalizeMarket(market: GammaMarket): Promise<NormalizedMarketInput | null> {
    const sourceMarketId = String(market.conditionId ?? market.id ?? "");
    if (!sourceMarketId || !market.question) return null;

    const outcomes = parseJsonArray<string>(market.outcomes);
    const outcomePrices = parseJsonArray<string | number>(market.outcomePrices).map(toNumber);
    const clobTokenIds = parseJsonArray<string>(market.clobTokenIds);
    const yesIndex = outcomes.findIndex((outcome) => /^yes$/i.test(outcome));
    const primaryIndex = yesIndex >= 0 ? yesIndex : 0;
    const primaryTokenId = clobTokenIds[primaryIndex] ?? clobTokenIds[0] ?? null;
    const clobQuote = primaryTokenId ? await this.fetchClobQuote(primaryTokenId) : null;
    const bid = clobQuote?.bid ?? toNumber(market.bestBid);
    const ask = clobQuote?.ask ?? toNumber(market.bestAsk);
    const midpoint = midpointFromBidAsk(bid, ask) ?? toNumber(market.lastTradePrice);
    const fallbackProbability = outcomePrices[primaryIndex] ?? outcomePrices[0] ?? null;
    const currentProbability = midpoint ?? fallbackProbability;

    return {
      sourcePlatform: SourcePlatform.POLYMARKET,
      sourceMarketId,
      sourceSlug: market.slug ?? null,
      question: market.question,
      eventTitle: market.events?.[0]?.title ?? market.question,
      category: inferCategory(market),
      outcomeType: outcomes.length > 2 ? OutcomeType.MULTIPLE_CHOICE : OutcomeType.BINARY,
      outcomes: outcomes.map((name, index) => ({
        name,
        probability: outcomePrices[index] ?? null,
        tokenId: clobTokenIds[index] ?? null
      })),
      currentProbability,
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
      sourceUrl: market.slug ? `https://polymarket.com/event/${market.slug}` : null,
      lastUpdated: parseDate(market.updatedAt) ?? new Date(),
      rawPayload: { gamma: market, clobQuote }
    };
  }

  private async fetchClobQuote(tokenId: string): Promise<{ bid: number | null; ask: number | null } | null> {
    try {
      const url = new URL("/book", this.clobUrl);
      url.searchParams.set("token_id", tokenId);
      const response = await fetch(url);
      if (!response.ok) return null;
      const book = (await response.json()) as ClobBook;
      return {
        bid: bestBid(book.bids),
        ask: bestAsk(book.asks)
      };
    } catch {
      return null;
    }
  }
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

function midpointFromBidAsk(bid: number | null, ask: number | null): number | null {
  if (bid === null || ask === null) return null;
  return (bid + ask) / 2;
}

function bestBid(bids: ClobBook["bids"]): number | null {
  const prices = bids?.map((bid) => toNumber(bid.price)).filter((price): price is number => price !== null) ?? [];
  return prices.length ? Math.max(...prices) : null;
}

function bestAsk(asks: ClobBook["asks"]): number | null {
  const prices = asks?.map((ask) => toNumber(ask.price)).filter((price): price is number => price !== null) ?? [];
  return prices.length ? Math.min(...prices) : null;
}

function inferResolutionStatus(market: GammaMarket): ResolutionStatus {
  if (market.archived) return ResolutionStatus.CLOSED;
  if (market.closed) return ResolutionStatus.RESOLVED;
  if (market.active) return ResolutionStatus.OPEN;
  return ResolutionStatus.UNKNOWN;
}

function inferCategory(market: GammaMarket): ForecastCategory {
  const haystack = [
    market.question,
    market.slug,
    ...(market.tags ?? []).map((tag) => (typeof tag === "string" ? tag : `${tag.label ?? ""} ${tag.slug ?? ""}`))
  ].join(" ").toLowerCase();

  if (/(fed|rate|inflation|cpi|gdp|recession|jobs|unemployment|macro|economy)/.test(haystack)) {
    return ForecastCategory.MACRO;
  }
  if (/(election|president|senate|house|trump|biden|congress|politics|primary)/.test(haystack)) {
    return ForecastCategory.POLITICS;
  }
  if (/(bitcoin|ethereum|crypto|btc|eth|solana)/.test(haystack)) {
    return ForecastCategory.CRYPTO;
  }
  if (/(war|ceasefire|country|minister|nato|world)/.test(haystack)) {
    return ForecastCategory.WORLD;
  }
  return ForecastCategory.OTHER;
}

export const polymarketTestInternals = {
  inferCategory,
  parseJsonArray,
  midpointFromBidAsk
};
