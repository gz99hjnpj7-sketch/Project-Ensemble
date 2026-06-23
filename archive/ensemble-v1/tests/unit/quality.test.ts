import { describe, expect, it } from "vitest";
import { ResolutionStatus, SignalConfidence } from "@prisma/client";
import { computeQualityScore } from "@/lib/forecast/quality";

describe("computeQualityScore", () => {
  const now = new Date("2026-06-22T12:00:00.000Z");

  it("marks liquid tight-spread markets as high confidence", () => {
    const result = computeQualityScore({
      liquidity: 100_000,
      volume: 500_000,
      bid: 0.61,
      ask: 0.62,
      lastUpdated: now,
      closeTime: new Date("2026-09-01T00:00:00.000Z"),
      resolutionStatus: ResolutionStatus.OPEN,
      createdAt: new Date("2026-06-20T12:00:00.000Z")
    }, now);

    expect(result.confidence).toBe(SignalConfidence.HIGH);
    expect(result.flags).toContain("tight spread");
    expect(result.flags).toContain("high liquidity");
  });

  it("penalizes stale thin markets", () => {
    const result = computeQualityScore({
      liquidity: 50,
      volume: 20,
      bid: 0.4,
      ask: 0.55,
      lastUpdated: new Date("2026-06-18T12:00:00.000Z"),
      closeTime: null,
      resolutionStatus: ResolutionStatus.OPEN,
      createdAt: null
    }, now);

    expect(result.confidence).toBe(SignalConfidence.LOW);
    expect(result.flags).toContain("low liquidity");
    expect(result.flags).toContain("stale market");
  });
});
