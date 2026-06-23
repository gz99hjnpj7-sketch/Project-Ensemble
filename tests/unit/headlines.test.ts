import { describe, expect, it } from "vitest";
import { generateFutureNewsHeadline } from "@/ensemble/news/headlines";

describe("generateFutureNewsHeadline", () => {
  it("labels presidential composites as leading-side probabilities", () => {
    const result = generateFutureNewsHeadline({
      slug: "us-presidential-2028",
      title: "US Presidential Election 2028",
      probability: 0.508,
      outcomeBreakdown: [
        { name: "Republican", probability: 0.508 },
        { name: "Democratic", probability: 0.458 }
      ],
      sources: [{ sourceRole: "headline", question: "Will JD Vance win the 2028 US Presidential Election?" }]
    });

    expect(result.headline).toBe("Republican side leads 2028 winner markets at 51%");
    expect(result.summary).toContain("not a single candidate probability");
  });

  it("describes Fed cut odds from market structure without external causal claims", () => {
    const result = generateFutureNewsHeadline({
      slug: "fed-rate-path",
      title: "Federal Reserve Rate Cut Odds",
      probability: 0.2015,
      movement: { sinceFirst: { probability: 0 } },
      sources: [{ sourceRole: "headline", question: "Will no Fed rate cuts happen in 2026?" }]
    });

    expect(result.headline).toBe("Fed cut odds hold near 20%");
    expect(result.summary).toContain("no-cut market");
    expect(result.summary).not.toContain("inflation");
  });
});
