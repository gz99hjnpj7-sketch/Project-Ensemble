import type { MarketConnector } from "./types";
import { PolymarketConnector } from "./polymarket";

export function getEnabledConnectors(): MarketConnector[] {
  return [new PolymarketConnector()];
}
