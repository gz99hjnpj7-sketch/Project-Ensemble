import type { MarketConnector } from "./types";
import { KalshiConnector } from "./kalshi";
import { PolymarketConnector } from "./polymarket";

export function getEnabledConnectors(): MarketConnector[] {
  return [new PolymarketConnector(), new KalshiConnector()];
}
