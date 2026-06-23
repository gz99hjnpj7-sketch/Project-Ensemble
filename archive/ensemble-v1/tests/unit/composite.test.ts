import { describe, expect, it } from "vitest";
import { SignalConfidence } from "@prisma/client";
import { computeCompositeForecast } from "@/lib/forecast/composite";

describe("computeCompositeForecast", () => {
  it("uses quality, recency, and manual overrides as weights", () => {
    const result = computeCompositeForecast([
      {
        marketId: "a",
        sourcePlatform: "POLYMARKET",
        question: "A",
        probability: 0.7,
        qualityScore: 90,
        recencyScore: 100,
        weightOverride: 1
      },
      {
        marketId: "b",
        sourcePlatform: "POLYMARKET",
        question: "B",
        probability: 0.3,
        qualityScore: 50,
        recencyScore: 50,
        weightOverride: 0.5
      }
    ]);

    expect(result.compositeProbability).toBeGreaterThan(0.64);
    expect(result.confidence).toBe(SignalConfidence.HIGH);
    expect(result.sourceBreakdown).toHaveLength(2);
  });

  it("returns null probability when no market has a probability", () => {
    const result = computeCompositeForecast([]);
    expect(result.compositeProbability).toBeNull();
    expect(result.qualityScore).toBe(0);
  });
});
