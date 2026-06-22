import { ForecastCategory, OutcomeType, ResolutionStatus, SourcePlatform } from "@prisma/client";
import type { NormalizedMarketInput } from "@/ensemble/connectors/types";
import type { KalshiMarket } from "./client";

export function normalizeKalshiMarket(market: KalshiMarket, observedAt: Date): NormalizedMarketInput | null {
  if (!market.ticker || !market.title) return null;
  const yesPrice = (market.yes_bid ?? 0) > 0 ? market.yes_bid! : (market.last_price ?? 50);
  const probability = Math.max(0, Math.min(1, yesPrice / 100));
  return {
    sourcePlatform: SourcePlatform.KALSHI,
    sourceMarketId: market.ticker,
    sourceSlug: market.ticker,
    question: market.title,
    eventTitle: market.title,
    category: inferCategory(market),
    outcomeType: OutcomeType.BINARY,
    outcomes: [{ name: "Yes", probability }],
    currentProbability: probability,
    bid: market.yes_bid ? market.yes_bid / 100 : null,
    ask: market.yes_ask ? market.yes_ask / 100 : null,
    midpoint: null,
    volume: market.volume ?? null,
    liquidity: null,
    openInterest: market.open_interest ?? null,
    tradeCount: null,
    participantCount: null,
    closeTime: market.close_time ? new Date(market.close_time) : null,
    resolutionStatus: market.status === "open" ? ResolutionStatus.OPEN : ResolutionStatus.UNKNOWN,
    sourceUrl: `https://kalshi.com/markets/${market.ticker}`,
    lastUpdated: observedAt,
    observedAt,
    rawPayload: market
  };
}

export function inferCategory(market: KalshiMarket): ForecastCategory {
  const text = `${market.title ?? ""} ${market.category ?? ""}`.toLowerCase();
  if (/election|senate|house|congress|president|trump|biden/.test(text)) return ForecastCategory.POLITICS;
  if (/fed|rate|inflation|cpi|recession|gdp|jobs/.test(text)) return ForecastCategory.MACRO;
  if (/bitcoin|btc|ethereum|eth|crypto|solana/.test(text)) return ForecastCategory.CRYPTO;
  return ForecastCategory.OTHER;
}
