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
      { marketId: "fed-no-cuts", sourcePlatform: "POLYMARKET", question: "Will no Fed rate cuts happen in 2026?", probability: 0.8, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [], requiresInversion: true }
    ], { targetMetric: "at-least-one-fed-cut-2026" });
    expect(result.compositeProbability).toBeCloseTo(0.2);
    expect(result.sourceBreakdown[0].probability).toBeCloseTo(0.2);
    expect(result.sourceBreakdown[0].rawProbability).toBeCloseTo(0.8);
    expect(result.sourceBreakdown[0].displayQuestion).toBe("Will no Fed rate cuts happen in 2026?");
    expect(result.sourceBreakdown[0].orientation).toContain("Inverted");
  });

  it("normalizes Republican House control into Democratic House control probability", () => {
    const result = computeCompositeForecast([
      { marketId: "house-r", sourcePlatform: "POLYMARKET", question: "Will the Republican Party control the House after the 2026 Midterm elections?", probability: 0.2, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [], requiresInversion: true }
    ], { targetMetric: "democratic-congress-control-2026" });
    expect(result.compositeProbability).toBeCloseTo(0.8);
    expect(result.sourceBreakdown[0].rawProbability).toBeCloseTo(0.2);
    expect(result.sourceBreakdown[0].displayQuestion).toBe("Will the Republican Party control the House after the 2026 Midterm elections?");
  });

  it("uses House-control binaries as headline sources while keeping balance buckets as support", () => {
    const result = computeCompositeForecast(
      [
        { marketId: "d-house", sourcePlatform: "POLYMARKET", question: "Will the Democratic Party control the House after the 2026 Midterm elections?", probability: 0.82, qualityScore: 96, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
        { marketId: "r-house", sourcePlatform: "POLYMARKET", question: "Will the Republican Party control the House after the 2026 Midterm elections?", probability: 0.2, qualityScore: 92, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [], requiresInversion: true },
        { marketId: "d-senate", sourcePlatform: "POLYMARKET", question: "Will the Democratic Party control the Senate after the 2026 Midterm elections?", probability: 0.43, qualityScore: 92, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
        { marketId: "r-senate", sourcePlatform: "POLYMARKET", question: "Will the Republican Party control the Senate after the 2026 Midterm elections?", probability: 0.57, qualityScore: 92, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [], requiresInversion: true },
        { marketId: "d-d", sourcePlatform: "POLYMARKET", question: "2026 Balance of Power: D Senate, D House", probability: 0.43, qualityScore: 92, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
        { marketId: "r-d", sourcePlatform: "POLYMARKET", question: "2026 Balance of Power: R Senate, D House", probability: 0.37, qualityScore: 92, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] }
      ],
      { targetMetric: "democratic-congress-control-2026" }
    );
    expect(result.sourceBreakdown.filter((source) => source.included)).toHaveLength(2);
    expect(result.sourceBreakdown.filter((source) => source.sourceRole === "supporting")).toHaveLength(4);
    expect(result.sourceBreakdown.find((source) => source.marketId === "r-house")?.probability).toBeCloseTo(0.8);
    expect(result.sourceBreakdown.find((source) => source.marketId === "r-senate")?.probability).toBeCloseTo(0.43);
    expect(result.compositeProbability).toBeGreaterThan(0.75);
    expect(result.compositeProbability).toBeLessThan(0.85);
  });

  it("uses direct House-control binaries ahead of lower balance-of-power buckets", () => {
    const result = computeCompositeForecast(
      [
        { marketId: "d-house", sourcePlatform: "POLYMARKET", question: "Will the Democratic Party control the House after the 2026 Midterm elections?", probability: 0.815, qualityScore: 96, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
        { marketId: "r-house", sourcePlatform: "POLYMARKET", question: "Will the Republican Party control the House after the 2026 Midterm elections?", probability: 0.195, qualityScore: 92, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [], requiresInversion: true },
        { marketId: "d-d", sourcePlatform: "POLYMARKET", question: "2026 Balance of Power: D Senate, D House", probability: 0.425, qualityScore: 92, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
        { marketId: "r-d", sourcePlatform: "POLYMARKET", question: "2026 Balance of Power: R Senate, D House", probability: 0.365, qualityScore: 92, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] }
      ],
      { targetMetric: "democratic-congress-control-2026" }
    );
    expect(result.compositeProbability).toBeGreaterThan(0.8);
    expect(result.compositeProbability).toBeLessThan(0.82);
    expect(result.sourceBreakdown.find((source) => source.marketId === "d-d")?.sourceRole).toBe("supporting");
    expect(result.sourceBreakdown.find((source) => source.marketId === "d-house")?.sourceRole).toBe("headline");
  });

  it("uses Fed no-cut binary as the headline source while keeping cut ladder as support", () => {
    const result = computeCompositeForecast(
      [
        { marketId: "no-cuts", sourcePlatform: "POLYMARKET", question: "Will no Fed rate cuts happen in 2026?", probability: 0.8, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [], requiresInversion: true },
        { marketId: "six-cuts", sourcePlatform: "POLYMARKET", question: "Will 6 Fed rate cuts happen in 2026?", probability: 0.0035, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
        { marketId: "twelve-plus", sourcePlatform: "POLYMARKET", question: "Will 12 or more Fed rate cuts happen in 2026?", probability: 0.0035, qualityScore: 80, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] }
      ],
      { targetMetric: "at-least-one-fed-cut-2026" }
    );
    expect(result.sourceBreakdown.filter((source) => source.included)).toHaveLength(1);
    expect(result.sourceBreakdown.filter((source) => source.sourceRole === "supporting")).toHaveLength(2);
    expect(result.sourceBreakdown.find((source) => source.marketId === "no-cuts")?.probability).toBeCloseTo(0.2);
    expect(result.compositeProbability).toBeCloseTo(0.2);
  });

  it("uses a direct Fed cut binary market ahead of weaker ladder buckets", () => {
    const result = computeCompositeForecast(
      [
        { marketId: "direct-cut", sourcePlatform: "POLYMARKET", question: "Will there be at least one Fed rate cut in 2026?", probability: 0.2, qualityScore: 95, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
        { marketId: "six-cuts", sourcePlatform: "POLYMARKET", question: "Will 6 Fed rate cuts happen in 2026?", probability: 0.035, qualityScore: 60, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
        { marketId: "seven-cuts", sourcePlatform: "POLYMARKET", question: "Will 7 Fed rate cuts happen in 2026?", probability: 0.035, qualityScore: 60, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] }
      ],
      { targetMetric: "at-least-one-fed-cut-2026" }
    );
    expect(result.compositeProbability).toBeCloseTo(0.2);
    expect(result.sourceBreakdown.find((source) => source.marketId === "direct-cut")?.sourceRole).toBe("headline");
    expect(result.sourceBreakdown.find((source) => source.marketId === "six-cuts")?.sourceRole).toBe("supporting");
  });

  it("falls back to summed Fed cut-count buckets when no binary headline exists", () => {
    const result = computeCompositeForecast(
      [
        { marketId: "six-cuts", sourcePlatform: "POLYMARKET", question: "Will 6 Fed rate cuts happen in 2026?", probability: 0.035, qualityScore: 60, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] },
        { marketId: "seven-cuts", sourcePlatform: "POLYMARKET", question: "Will 7 Fed rate cuts happen in 2026?", probability: 0.035, qualityScore: 60, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [] }
      ],
      { targetMetric: "at-least-one-fed-cut-2026" }
    );
    expect(result.compositeProbability).toBeCloseTo(0.07);
    expect(result.sourceBreakdown.filter((source) => source.included)).toHaveLength(2);
  });

  it("classifies common 2028 candidates into party sides before aggregating binary winner contracts", () => {
    const result = computeCompositeForecast(
      [
        { marketId: "walz", sourcePlatform: "POLYMARKET", question: "Will Tim Walz win the 2028 US Presidential Election?", probability: 0.1, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [], outcomes: [{ name: "Yes", probability: 0.1 }, { name: "No", probability: 0.9 }] },
        { marketId: "abbott", sourcePlatform: "POLYMARKET", question: "Will Greg Abbott win the 2028 US Presidential Election?", probability: 0.2, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [], outcomes: [{ name: "Yes", probability: 0.2 }, { name: "No", probability: 0.8 }] },
        { marketId: "ossoff", sourcePlatform: "POLYMARKET", question: "Will Jon Ossoff win the 2028 US Presidential Election?", probability: 0.3, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [], outcomes: [{ name: "Yes", probability: 0.3 }, { name: "No", probability: 0.7 }] },
        { marketId: "youngkin", sourcePlatform: "POLYMARKET", question: "Will Glenn Youngkin win the 2028 US Presidential Election?", probability: 0.4, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [], outcomes: [{ name: "Yes", probability: 0.4 }, { name: "No", probability: 0.6 }] }
      ],
      { targetMetric: "presidential-winner-2028" }
    );
    expect(result.outcomeBreakdown?.[0].name).toBe("Republican");
    expect(result.outcomeBreakdown?.[0].probability).toBeCloseTo(0.6);
    expect(result.outcomeBreakdown?.[1].name).toBe("Democratic");
    expect(result.outcomeBreakdown?.[1].probability).toBeCloseTo(0.4);
    expect(result.compositeProbability).toBeCloseTo(0.6);
  });

  it("uses normalized party outcomes for presidential winner books", () => {
    const result = computeCompositeForecast(
      [
        {
          marketId: "party-book",
          sourcePlatform: "POLYMARKET",
          question: "2028 Presidential Election Winner",
          probability: 0.59,
          qualityScore: 90,
          recencyScore: 100,
          resolutionStatus: ResolutionStatus.OPEN,
          warnings: [],
          outcomes: [
            { name: "Democrat", probability: 0.59 },
            { name: "Republican", probability: 0.41 }
          ]
        }
      ],
      { targetMetric: "presidential-winner-2028" }
    );
    expect(result.compositeProbability).toBeCloseTo(0.59);
    expect(result.outcomeBreakdown?.[0]).toMatchObject({ name: "Democratic", probability: 0.59 });
  });

  it("sums mutually exclusive Democratic candidates within a presidential winner book", () => {
    const result = computeCompositeForecast(
      [
        {
          marketId: "candidate-book",
          sourcePlatform: "POLYMARKET",
          question: "2028 Presidential Election Winner",
          probability: 0.3,
          qualityScore: 90,
          recencyScore: 100,
          resolutionStatus: ResolutionStatus.OPEN,
          warnings: [],
          outcomes: [
            { name: "Kamala Harris", probability: 0.3 },
            { name: "Michelle Obama", probability: 0.25 },
            { name: "Republican", probability: 0.45 }
          ]
        }
      ],
      { targetMetric: "presidential-winner-2028" }
    );
    expect(result.compositeProbability).toBeCloseTo(0.55);
    expect(result.outcomeBreakdown?.[0]).toMatchObject({ name: "Democratic", probability: 0.55 });
  });

  it("builds one presidential book from separate binary candidate contracts", () => {
    const result = computeCompositeForecast(
      [
        { marketId: "kamala", sourcePlatform: "POLYMARKET", question: "Will Kamala Harris win the 2028 US Presidential Election?", probability: 0.3, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [], outcomes: [{ name: "Yes", probability: 0.3 }, { name: "No", probability: 0.7 }] },
        { marketId: "michelle", sourcePlatform: "POLYMARKET", question: "Will Michelle Obama win the 2028 US Presidential Election?", probability: 0.25, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [], outcomes: [{ name: "Yes", probability: 0.25 }, { name: "No", probability: 0.75 }] },
        { marketId: "vance", sourcePlatform: "POLYMARKET", question: "Will JD Vance win the 2028 US Presidential Election?", probability: 0.45, qualityScore: 90, recencyScore: 100, resolutionStatus: ResolutionStatus.OPEN, warnings: [], outcomes: [{ name: "Yes", probability: 0.45 }, { name: "No", probability: 0.55 }] }
      ],
      { targetMetric: "presidential-winner-2028" }
    );
    expect(result.compositeProbability).toBeCloseTo(0.55);
    expect(result.outcomeBreakdown?.[0]).toMatchObject({ name: "Democratic", probability: 0.55 });
  });

  it("weights duplicate presidential winner books instead of blindly summing them", () => {
    const result = computeCompositeForecast(
      [
        {
          marketId: "party-book",
          sourcePlatform: "POLYMARKET",
          question: "2028 Presidential Election Winner",
          probability: 0.59,
          qualityScore: 90,
          recencyScore: 100,
          resolutionStatus: ResolutionStatus.OPEN,
          warnings: [],
          outcomes: [
            { name: "Democrat", probability: 0.59 },
            { name: "Republican", probability: 0.41 }
          ]
        },
        {
          marketId: "candidate-book",
          sourcePlatform: "POLYMARKET",
          question: "2028 Presidential Election Winner",
          probability: 0.3,
          qualityScore: 90,
          recencyScore: 100,
          resolutionStatus: ResolutionStatus.OPEN,
          warnings: [],
          outcomes: [
            { name: "Kamala Harris", probability: 0.3 },
            { name: "Michelle Obama", probability: 0.25 },
            { name: "Republican", probability: 0.45 }
          ]
        }
      ],
      { targetMetric: "presidential-winner-2028" }
    );
    expect(result.compositeProbability).toBeCloseTo(0.57);
    expect(result.compositeProbability).toBeLessThan(1);
  });
});
