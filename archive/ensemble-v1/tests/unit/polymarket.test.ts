import { describe, expect, it } from "vitest";
import { ForecastCategory } from "@prisma/client";
import { polymarketTestInternals } from "@/lib/connectors/polymarket";
import { gammaMarketFixture } from "../fixtures/polymarket";

describe("Polymarket helpers", () => {
  it("parses JSON arrays from Gamma string fields", () => {
    expect(polymarketTestInternals.parseJsonArray<string>(gammaMarketFixture.outcomes)).toEqual(["Yes", "No"]);
  });

  it("computes midpoint from bid and ask", () => {
    expect(polymarketTestInternals.midpointFromBidAsk(0.61, 0.63)).toBeCloseTo(0.62);
  });

  it("infers macro category from Fed market metadata", () => {
    expect(polymarketTestInternals.inferCategory(gammaMarketFixture)).toBe(ForecastCategory.MACRO);
  });
});
