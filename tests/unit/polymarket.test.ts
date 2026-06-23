import { describe, expect, it } from "vitest";
import { ForecastCategory } from "@prisma/client";
import { polymarketTestInternals } from "@/ensemble/connectors/polymarket";
import { gammaMarketFixture } from "../fixtures/polymarket";

describe("Polymarket helpers", () => {
  it("parses JSON arrays from Gamma string fields", () => {
    expect(polymarketTestInternals.parseJsonArray(gammaMarketFixture.outcomes)).toEqual(["Yes", "No"]);
  });
  it("computes midpoint from bid and ask", () => {
    expect(polymarketTestInternals.midpointFromBidAsk(0.61, 0.63)).toBeCloseTo(0.62);
  });
  it("infers macro category from Fed market metadata", () => {
    expect(polymarketTestInternals.inferCategory(gammaMarketFixture)).toBe(ForecastCategory.MACRO);
  });
  it("does not classify Netherlands text as crypto from the eth substring", () => {
    expect(polymarketTestInternals.inferCategory({ question: "Will Netherlands win the 2026 FIFA World Cup?", slug: "will-netherlands-win-world-cup" })).not.toBe(ForecastCategory.CRYPTO);
  });
  it("builds grouped-event URLs that preserve the exact child market slug", () => {
    expect(polymarketTestInternals.buildPolymarketSourceUrl({
      slug: "will-10-fed-rate-cuts-happen-in-2026",
      events: [{ slug: "how-many-fed-rate-cuts-in-2026", title: "How many Fed rate cuts in 2026?" }]
    })).toBe("https://polymarket.com/event/how-many-fed-rate-cuts-in-2026#will-10-fed-rate-cuts-happen-in-2026");
  });
});
