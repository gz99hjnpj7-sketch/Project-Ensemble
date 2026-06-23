import { SignalConfidence } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildForecastCurrentPayload } from "@/lib/processing/cache";

describe("buildForecastCurrentPayload", () => {
  it("creates a cached forecast payload from composite and cluster metrics", () => {
    const payload = buildForecastCurrentPayload({
      clusterId: "cluster-1",
      composite: {
        compositeProbability: 0.62,
        confidence: SignalConfidence.HIGH,
        qualityScore: 81,
        sourceBreakdown: [{
          marketId: "m1",
          sourcePlatform: "POLYMARKET",
          question: "Will the Fed cut rates?",
          probability: 0.62,
          qualityScore: 81,
          recencyScore: 100,
          weight: 0.81,
          contribution: 0.62
        }]
      },
      marketCount: 4,
      warningCount: 2,
      move24h: 0.03,
      processedAt: new Date("2026-06-22T12:00:00.000Z")
    });

    expect(payload).toEqual({
      clusterId: "cluster-1",
      compositeValue: 0.62,
      confidence: SignalConfidence.HIGH,
      confidenceScore: 81,
      marketCount: 4,
      warningCount: 2,
      move24h: 0.03,
      sourceBreakdown: [{
        marketId: "m1",
        sourcePlatform: "POLYMARKET",
        question: "Will the Fed cut rates?",
        probability: 0.62,
        qualityScore: 81,
        recencyScore: 100,
        weight: 0.81,
        contribution: 0.62
      }],
      processedAt: new Date("2026-06-22T12:00:00.000Z")
    });
  });
});
