export type GammaMarket = {
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
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  clobTokenIds?: string | string[];
  bestBid?: string | number;
  bestAsk?: string | number;
  lastTradePrice?: string | number;
  tags?: Array<{ label?: string; slug?: string }> | string[];
  events?: Array<{ title?: string; slug?: string }>;
};

export type ClobQuote = { bid: number | null; ask: number | null };

type ClobBook = {
  bids?: Array<{ price?: string; size?: string }>;
  asks?: Array<{ price?: string; size?: string }>;
};

const DEFAULT_GAMMA_URL = "https://gamma-api.polymarket.com";
const DEFAULT_CLOB_URL = "https://clob.polymarket.com";

export class PolymarketClient {
  private gammaUrl = process.env.POLYMARKET_GAMMA_URL ?? DEFAULT_GAMMA_URL;
  private clobUrl = process.env.POLYMARKET_CLOB_URL ?? DEFAULT_CLOB_URL;
  private marketLimit = Number(process.env.INGEST_MARKET_LIMIT ?? 500);

  async fetchGammaMarkets(order: "volumeNum" | "liquidityNum" = "volumeNum", search?: string): Promise<GammaMarket[]> {
    const url = new URL("/markets", this.gammaUrl);
    url.searchParams.set("limit", String(this.marketLimit));
    url.searchParams.set("active", "true");
    url.searchParams.set("closed", "false");
    url.searchParams.set("order", order);
    url.searchParams.set("ascending", "false");
    if (search) url.searchParams.set("search", search);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Polymarket Gamma request failed: ${response.status} ${response.statusText}`);
    const payload = await response.json();
    return Array.isArray(payload) ? payload : payload.markets ?? [];
  }

  async fetchClobQuote(tokenId: string): Promise<ClobQuote | null> {
    try {
      const url = new URL("/book", this.clobUrl);
      url.searchParams.set("token_id", tokenId);
      const response = await fetch(url);
      if (!response.ok) return null;
      const book = (await response.json()) as ClobBook;
      return { bid: bestBid(book.bids), ask: bestAsk(book.asks) };
    } catch {
      return null;
    }
  }
}

function bestBid(bids: ClobBook["bids"]): number | null {
  const prices = bids?.map((bid) => toNumber(bid.price)).filter((price): price is number => price !== null) ?? [];
  return prices.length ? Math.max(...prices) : null;
}

function bestAsk(asks: ClobBook["asks"]): number | null {
  const prices = asks?.map((ask) => toNumber(ask.price)).filter((price): price is number => price !== null) ?? [];
  return prices.length ? Math.min(...prices) : null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
