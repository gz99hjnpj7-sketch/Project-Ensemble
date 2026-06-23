import { ForecastCategory, SourcePlatform } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { matchMarketToSeedCluster } from "@/lib/processing/matcher";

describe("matchMarketToSeedCluster", () => {
  it("maps Fed rate markets to the Fed rate path cluster", () => {
    const match = matchMarketToSeedCluster({
      sourcePlatform: SourcePlatform.POLYMARKET,
      question: "Will the Fed cut rates at the September FOMC meeting?",
      eventTitle: "Fed rate cuts",
      sourceSlug: "fed-cut-rates-september",
      category: ForecastCategory.MACRO
    });

    expect(match?.slug).toBe("fed-rate-path");
  });

  it("leaves unrelated markets unclustered", () => {
    const match = matchMarketToSeedCluster({
      sourcePlatform: SourcePlatform.POLYMARKET,
      question: "Will a celebrity release a new album this week?",
      eventTitle: "Entertainment markets",
      sourceSlug: "celebrity-album-this-week",
      category: ForecastCategory.OTHER
    });

    expect(match).toBeNull();
  });
});
