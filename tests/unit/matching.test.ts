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

  it("keeps Senate markets out of the House-focused midterms cluster", () => {
    const result = matchDeterministically(
      { question: "Will the Republican Party control the Senate after the 2026 Midterm elections?", eventTitle: "US Senate Control", sourceSlug: null, category: ForecastCategory.POLITICS },
      [{ id: "house", slug: "us-2026-midterms", category: ForecastCategory.POLITICS, title: "US 2026 House Control", description: "House control" }]
    );
    expect(result.kind).toBe("unmatched");
  });

  it("keeps unknown markets unclustered", () => {
    const result = matchDeterministically({ question: "Will a pop singer release an album?", eventTitle: "Music", sourceSlug: null, category: ForecastCategory.OTHER }, clusters);
    expect(result.kind).toBe("unmatched");
  });
});
