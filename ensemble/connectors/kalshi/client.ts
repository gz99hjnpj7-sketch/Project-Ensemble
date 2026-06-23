export type KalshiMarket = {
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

export class KalshiClient {
  async fetchOpenMarkets(): Promise<KalshiMarket[]> {
    const res = await fetch(`${KALSHI_API}?limit=200&status=open`, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.markets || data.data?.markets || [];
  }
}
