import { SourcePlatform } from "@prisma/client";
import type { MarketConnector, NormalizedMarketInput } from "@/ensemble/connectors/types";
import { PolymarketClient, type GammaMarket } from "./client";
import { getPrimaryTokenId, inferCategory, midpointFromBidAsk, normalizePolymarketMarket, parseJsonArray } from "./normalize";

const TOPIC_SEARCHES = ["fed", "rate cut", "fomc", "inflation", "cpi", "recession", "unemployment", "senate", "house majority", "congress control", "nomination", "greenland"];

export class PolymarketConnector implements MarketConnector {
  sourcePlatform = SourcePlatform.POLYMARKET;
  private client = new PolymarketClient();
  private minLiquidity = Number(process.env.MIN_LIQUIDITY ?? 500);

  async fetchMarkets(now = new Date()): Promise<NormalizedMarketInput[]> {
    const [byVolume, byLiquidity, unsorted] = await Promise.all([
      this.client.fetchGammaMarkets("volumeNum"),
      this.client.fetchGammaMarkets("liquidityNum"),
      this.client.fetchGammaMarkets()
    ]);
    const all = [...byVolume, ...byLiquidity, ...unsorted];
    for (const term of TOPIC_SEARCHES) {
      try {
        all.push(...await this.client.fetchGammaMarkets("volumeNum", term));
      } catch {}
    }
    const unique = dedupeBySourceId(all).filter((market) => this.isWorthNormalizing(market));
    const normalized = await Promise.all(unique.map(async (market) => {
      const tokenId = getPrimaryTokenId(market);
      const clobQuote = tokenId ? await this.client.fetchClobQuote(tokenId) : null;
      return normalizePolymarketMarket(market, { clobQuote, observedAt: now });
    }));
    return normalized.filter((market): market is NormalizedMarketInput => Boolean(market));
  }

  private isWorthNormalizing(market: GammaMarket): boolean {
    const liquidity = toNumber(market.liquidityNum ?? market.liquidity) ?? 0;
    const volume = toNumber(market.volumeNum ?? market.volume) ?? 0;
    const text = `${market.question ?? ""} ${market.slug ?? ""}`.toLowerCase();
    const fromTopicSearch = TOPIC_SEARCHES.some((term) => text.includes(term));
    return liquidity >= this.minLiquidity || volume >= 100_000 || fromTopicSearch;
  }
}

function dedupeBySourceId(markets: GammaMarket[]): GammaMarket[] {
  const seen = new Set<string>();
  return markets.filter((market) => {
    const id = String(market.conditionId ?? market.id ?? "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const polymarketTestInternals = { parseJsonArray, midpointFromBidAsk, inferCategory };
