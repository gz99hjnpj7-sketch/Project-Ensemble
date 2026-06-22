import { describe, expect, it } from "vitest";
import { ForecastCategory } from "@prisma/client";
import { matchDeterministically } from "@/ensemble/matching/deterministic";

const clusters = [
  { id: "fed", slug: "fed-rate-path", category: ForecastCategory.MACRO, title: "Federal Reserve Interest Rate Path", description: "Fed rate decisions" },
  { id: "btc", slug: "bitcoin-price", category: ForecastCategory.CRYPTO, title: "Bitcoin Price Milestones", description: "Bitcoin price" }
];

describe("matchDeterministically", () => {
  it("matches a known seed market", () => {
    const result = matchDeterministically({ question: "Will the Fed cut interest rates in July?", eventTitle: "FOMC", sourceSlug: null, category: ForecastCategory.MACRO }, clusters);
    expect(result.kind).toBe("matched");
    if (result.kind === "matched") expect(result.clusterId).toBe("fed");
  });
  it("keeps unknown markets unclustered", () => {
    const result = matchDeterministically({ question: "Will a pop singer release an album?", eventTitle: "Music", sourceSlug: null, category: ForecastCategory.OTHER }, clusters);
    expect(result.kind).toBe("unmatched");
  });
});
