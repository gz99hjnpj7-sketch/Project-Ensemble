import { SourcePlatform } from "@prisma/client";
import type { MarketConnector, NormalizedMarketInput } from "@/ensemble/connectors/types";
import { KalshiClient } from "./client";
import { normalizeKalshiMarket } from "./normalize";

export class KalshiConnector implements MarketConnector {
  sourcePlatform = SourcePlatform.KALSHI;
  private client = new KalshiClient();

  async fetchMarkets(now = new Date()): Promise<NormalizedMarketInput[]> {
    try {
      const markets = await this.client.fetchOpenMarkets();
      return markets.map((market) => normalizeKalshiMarket(market, now)).filter((market): market is NormalizedMarketInput => Boolean(market));
    } catch {
      return [];
    }
  }
}
