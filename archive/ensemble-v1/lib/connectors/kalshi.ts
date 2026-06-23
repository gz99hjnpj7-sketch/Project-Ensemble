import type { MarketConnector, NormalizedMarketInput } from "./types";
import { ForecastCategory, OutcomeType, ResolutionStatus, SourcePlatform } from "@prisma/client";

type KalshiMarket = {
  ticker?: string;
  title?: string;
  yes_bid?: number;
  yes_ask?: number;
  last_price?: number;
  volume?: number;
  open_interest?: number;
  close_time?: string;
  status?: string;
  category?: string;
};

const KALSHI_API = "https://trading-api.kalshi.com/trade-api/v2/markets";

export class KalshiConnector implements MarketConnector {
  sourcePlatform = SourcePlatform.KALSHI as any; // add to enum later if strict

  async fetchMarkets(): Promise<NormalizedMarketInput[]> {
    try {
      // Basic public markets fetch (limit is small by default)
      const res = await fetch(`${KALSHI_API}?limit=200&status=open`, {
        headers: { Accept: "application/json" }
      });
      if (!res.ok) return [];
      const data = await res.json();
      const markets: KalshiMarket[] = data.markets || data.data?.markets || [];

      return markets
        .filter((m) => m.ticker && m.title)
        .map((m) => this.normalize(m))
        .filter(Boolean) as NormalizedMarketInput[];
    } catch {
      return [];
    }
  }

  private normalize(m: KalshiMarket): NormalizedMarketInput | null {
    const yesPrice = (m.yes_bid ?? 0) > 0 ? m.yes_bid! : (m.last_price ?? 50);
    const prob = Math.max(0, Math.min(1, yesPrice / 100));

    return {
      sourcePlatform: "KALSHI" as any,
      sourceMarketId: m.ticker!,
      sourceSlug: m.ticker || null,
      question: m.title || m.ticker!,
      eventTitle: m.title || "Kalshi Event",
      category: this.inferCategory(m),
      outcomeType: OutcomeType.BINARY,
      outcomes: [{ name: "Yes", probability: prob }],
      currentProbability: prob,
      bid: m.yes_bid ? m.yes_bid / 100 : null,
      ask: m.yes_ask ? m.yes_ask / 100 : null,
      volume: m.volume ?? null,
      liquidity: null,
      openInterest: m.open_interest ?? null,
      closeTime: m.close_time ? new Date(m.close_time) : null,
      resolutionStatus: m.status === "open" ? ResolutionStatus.OPEN : ResolutionStatus.UNKNOWN,
      sourceUrl: m.ticker ? `https://kalshi.com/markets/${m.ticker}` : null,
      lastUpdated: new Date(),
      rawPayload: m
    };
  }

  private inferCategory(m: KalshiMarket): ForecastCategory {
    const t = ((m.title || "") + " " + (m.category || "")).toLowerCase();
    if (/election|senate|house|congress|president|trump|biden/.test(t)) return ForecastCategory.POLITICS;
    if (/fed|rate|inflation|cpi|recession|gdp|jobs/.test(t)) return ForecastCategory.MACRO;
    if (/bitcoin|btc|ethereum|eth|crypto|solana/.test(t)) return ForecastCategory.CRYPTO;
    return ForecastCategory.OTHER;
  }
}
