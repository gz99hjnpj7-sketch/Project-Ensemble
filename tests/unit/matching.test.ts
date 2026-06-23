import { describe, expect, it } from "vitest";
import { ForecastCategory } from "@prisma/client";
import { seedClusters } from "@/ensemble/config/clusters";
import { matchDeterministically } from "@/ensemble/matching/deterministic";

const clusters = [
  { id: "fed", slug: "fed-rate-path", category: ForecastCategory.MACRO, title: "Federal Reserve Rate Cut Odds", description: "Fed rate cut odds" },
  { id: "btc", slug: "bitcoin-price", category: ForecastCategory.CRYPTO, title: "Bitcoin Price Milestones", description: "Bitcoin price" },
  { id: "noise", slug: "robotaxi-launch", category: ForecastCategory.OTHER, title: "Robotaxi Launch", description: "Robotaxi commercial launch" }
];

describe("matchDeterministically", () => {
  it("keeps the active seed list focused on the first useful composites", () => {
    expect(seedClusters.map((cluster) => cluster.slug)).toEqual([
      "us-presidential-2028",
      "fed-rate-path",
      "us-2026-midterms",
      "frontier-ai-timeline",
      "bitcoin-price"
    ]);
  });

  it("matches a known seed market", () => {
    const result = matchDeterministically({ question: "Will no Fed rate cuts happen in 2026?", eventTitle: "Fed cuts", sourceSlug: null, category: ForecastCategory.MACRO }, clusters);
    expect(result.kind).toBe("matched");
    if (result.kind === "matched") expect(result.clusterId).toBe("fed");
  });

  it("marks known inverse matches with requiresInversion metadata", () => {
    const result = matchDeterministically({ question: "Will no Fed rate cuts happen in 2026?", eventTitle: "Fed cuts", sourceSlug: null, category: ForecastCategory.MACRO }, clusters);
    expect(result.kind).toBe("matched");
    if (result.kind === "matched") expect(result.requiresInversion).toBe(true);
  });

  it("leaves direct-side matches non-inverted", () => {
    const result = matchDeterministically({ question: "Will there be at least one Fed rate cut in 2026?", eventTitle: "Fed cuts", sourceSlug: null, category: ForecastCategory.MACRO }, clusters);
    expect(result.kind).toBe("matched");
    if (result.kind === "matched") expect(result.requiresInversion).toBe(false);
  });

  it("matches Fed cut ladder outcomes into the Fed rate path cluster", () => {
    const result = matchDeterministically(
      {
        question: "Will 6 Fed rate cuts happen in 2026?",
        eventTitle: "How many Fed rate cuts in 2026?",
        sourceSlug: "will-6-fed-rate-cuts-happen-in-2026",
        category: ForecastCategory.MACRO
      },
      clusters
    );
    expect(result.kind).toBe("matched");
    if (result.kind === "matched") expect(result.clusterId).toBe("fed");
  });

  it("does not use generic title words to create accidental matches", () => {
    const result = matchDeterministically({ question: "Will robotaxis launch in Austin before July?", eventTitle: "Autonomous Vehicles", sourceSlug: null, category: ForecastCategory.OTHER }, clusters);
    expect(result.kind).toBe("unmatched");
  });

  it("does not treat FedEx sports text as a Federal Reserve market", () => {
    const result = matchDeterministically({ question: "Will Sahith Theegala win the Tour Championship?", eventTitle: "FedEx Cup", sourceSlug: "fedex-cup-tour-championship", category: ForecastCategory.OTHER }, clusters);
    expect(result.kind).toBe("unmatched");
  });

  it("blocks nominee markets from the presidential winner cluster", () => {
    const result = matchDeterministically(
      { question: "Will Gavin Newsom win the 2028 Democratic presidential nomination?", eventTitle: "Democratic Presidential Nominee 2028", sourceSlug: null, category: ForecastCategory.POLITICS },
      [{ id: "pres", slug: "us-presidential-2028", category: ForecastCategory.POLITICS, title: "US Presidential Election 2028", description: "Winner markets" }]
    );
    expect(result.kind).toBe("unmatched");
  });

  it("keeps standalone Senate control out of the House-control midterms cluster", () => {
    const result = matchDeterministically(
      { question: "Will the Republican Party control the Senate after the 2026 Midterm elections?", eventTitle: "US Senate Control", sourceSlug: null, category: ForecastCategory.POLITICS },
      [{ id: "midterms", slug: "us-2026-midterms", category: ForecastCategory.POLITICS, title: "US 2026 Midterms", description: "Congress control" }]
    );
    expect(result.kind).toBe("unmatched");
  });

  it("matches Democratic-House balance-of-power outcomes into the 2026 midterms cluster", () => {
    const result = matchDeterministically(
      {
        question: "2026 Balance of Power: R Senate, D House",
        eventTitle: "Balance of Power: 2026 Midterms",
        sourceSlug: "balance-of-power-2026-midterms-r-senate-d-house",
        category: ForecastCategory.POLITICS
      },
      [{ id: "midterms", slug: "us-2026-midterms", category: ForecastCategory.POLITICS, title: "US 2026 Midterms", description: "Congress control" }]
    );
    expect(result.kind).toBe("matched");
  });

  it("keeps exact Senate-seat markets out of the broad midterms cluster", () => {
    const result = matchDeterministically(
      {
        question: "Will the Republican Party hold exactly 54 Senate seats after the 2026 midterm elections?",
        eventTitle: "Republican Senate seats after the 2026 midterm elections",
        sourceSlug: null,
        category: ForecastCategory.POLITICS
      },
      [{ id: "midterms", slug: "us-2026-midterms", category: ForecastCategory.POLITICS, title: "US 2026 Midterms", description: "Congress control" }]
    );
    expect(result.kind).toBe("unmatched");
  });

  it("keeps unknown markets unclustered", () => {
    const result = matchDeterministically({ question: "Will a pop singer release an album?", eventTitle: "Music", sourceSlug: null, category: ForecastCategory.OTHER }, clusters);
    expect(result.kind).toBe("unmatched");
  });
});
