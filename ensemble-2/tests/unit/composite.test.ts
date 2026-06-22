import { describe, expect, it } from "vitest";
import { ResolutionStatus, SignalConfidence, WarningType } from "@prisma/client";
import { computeCompositeForecast } from "@/ensemble/composite/compute";

describe("computeCompositeForecast", () => {
  it("uses quality, recency, and manual overrides as weights", () => {
    const result = computeCompositeForecast([
      { marketId: "a", sourcePlatform: "POLYMARKET", question: "A", probability: 0.7, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [], weightOverride: 1 },
      { marketId: "b", sourcePlatform: "POLYMARKET", question: "B", probability: 0.3, qualityScore: 50, recencyScore: 50, resolutionStatus: ResolutionStatus.OPEN, warnings: [], weightOverride: 0.5 }
    ]);
    expect(result.compositeProbability).toBeGreaterThan(0.64);
    expect(result.confidence).toBe(SignalConfidence.HIGH);
    expect(result.sourceBreakdown).toHaveLength(2);
  });
  it("makes policy decisions explicit", () => {
    const result = computeCompositeForecast([
      { marketId: "a", sourcePlatform: "POLYMARKET", question: "A", probability: null, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
      { marketId: "b", sourcePlatform: "POLYMARKET", question: "B", probability: 0.4, qualityScore: 80, recencyScore: 20, resolutionStatus: ResolutionStatus.OPEN, warnings: [{ type: WarningType.STALE_MARKET }] }
    ]);
    expect(result.compositeProbability).toBeNull();
    expect(result.policy.excludedSources.map((source) => source.reason)).toEqual(expect.arrayContaining(["missing_probability", "stale"]));
  });
});
