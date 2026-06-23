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
  it("does not let temporary warning filters exclude usable markets", () => {
    const result = computeCompositeForecast([
      { marketId: "a", sourcePlatform: "POLYMARKET", question: "A", probability: null, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
      { marketId: "b", sourcePlatform: "POLYMARKET", question: "B", probability: 0.4, qualityScore: 80, recencyScore: 20, resolutionStatus: ResolutionStatus.OPEN, warnings: [{ type: WarningType.STALE_MARKET }] }
    ]);
    expect(result.compositeProbability).toBe(0.4);
    expect(result.policy.excludedSources.map((source) => source.reason)).toEqual(["missing_probability"]);
    expect(result.policy.flags).toContain("warnings shown but not used for filtering");
  });

  it("normalizes no-cut Fed markets into at-least-one-cut probability", () => {
    const result = computeCompositeForecast([
      { marketId: "fed-no-cuts", sourcePlatform: "POLYMARKET", question: "Will no Fed rate cuts happen in 2026?", probability: 0.8, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] }
    ]);
    expect(result.compositeProbability).toBeCloseTo(0.2);
    expect(result.sourceBreakdown[0].probability).toBeCloseTo(0.2);
    expect(result.sourceBreakdown[0].rawProbability).toBeCloseTo(0.8);
    expect(result.sourceBreakdown[0].displayQuestion).toBe("At least one Fed rate cut in 2026");
    expect(result.sourceBreakdown[0].orientation).toContain("Inverted");
  });

  it("normalizes Republican House control into Democratic House control probability", () => {
    const result = computeCompositeForecast([
      { marketId: "house-r", sourcePlatform: "POLYMARKET", question: "Will the Republican Party control the House after the 2026 Midterm elections?", probability: 0.2, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] }
    ]);
    expect(result.compositeProbability).toBeCloseTo(0.8);
    expect(result.sourceBreakdown[0].rawProbability).toBeCloseTo(0.2);
    expect(result.sourceBreakdown[0].displayQuestion).toBe("Democratic control of the House after 2026 midterms");
  });
});
