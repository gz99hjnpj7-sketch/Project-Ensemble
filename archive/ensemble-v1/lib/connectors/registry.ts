import type { MarketConnector } from "./types";
import { PolymarketConnector } from "./polymarket";
import { KalshiConnector } from "./kalshi";

export function getEnabledConnectors(): MarketConnector[] {
  return [
    new PolymarketConnector(),
    new KalshiConnector(),   // second source — cross-platform ensemble begins
  ];
}
