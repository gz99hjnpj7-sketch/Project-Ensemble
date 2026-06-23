import { describe, expect, it } from "vitest";
import { ForecastCategory } from "@prisma/client";
import { matchDeterministically } from "@/ensemble/matching/deterministic";

const clusters = [
  { id: "midterms", slug: "us-2026-midterms", category: ForecastCategory.POLITICS, title: "US 2026 Midterms", description: "Congress control" },
  { id: "fed", slug: "fed-rate-path", category: ForecastCategory.MACRO, title: "Federal Reserve Rate Cut Odds", description: "Fed cuts" },
  { id: "btc", slug: "bitcoin-price", category: ForecastCategory.CRYPTO, title: "Bitcoin Price Milestones", description: "Bitcoin upside" }
];

describe("cluster source coverage", () => {
  it("matches only House-control 2026 midterms source families", () => {
    const questions = [
      "Will the Democratic Party control the House after the 2026 Midterm elections?",
      "Will the Republican Party control the House after the 2026 Midterm elections?",
      "2026 Balance of Power: D Senate, D House",
      "2026 Balance of Power: R Senate, D House"
    ];
    const matched = questions.filter((question) => matchDeterministically({ question, eventTitle: "Balance of Power: 2026 Midterms", sourceSlug: null, category: ForecastCategory.POLITICS }, clusters).kind === "matched");
    expect(matched).toHaveLength(4);
  });

  it("matches the Fed 2026 cut-count ladder family", () => {
    const questions = [
      "Will no Fed rate cuts happen in 2026?",
      "Will 6 Fed rate cuts happen in 2026?",
      "Will 7 Fed rate cuts happen in 2026?",
      "Will 8 Fed rate cuts happen in 2026?",
      "Will 9 Fed rate cuts happen in 2026?",
      "Will 10 Fed rate cuts happen in 2026?",
      "Will 11 Fed rate cuts happen in 2026?",
      "Will 12 or more Fed rate cuts happen in 2026?"
    ];
    const matched = questions.filter((question) => matchDeterministically({ question, eventTitle: "How many Fed rate cuts in 2026?", sourceSlug: null, category: ForecastCategory.MACRO }, clusters).kind === "matched");
    expect(matched).toHaveLength(8);
  });

  it("keeps known noisy markets out of broad clusters", () => {
    const noisy = [
      { question: "Fed rate hike in 2026?", eventTitle: "Fed rate hike in 2026?", category: ForecastCategory.MACRO },
      { question: "Will Al Mina be the Republican nominee for Senate in Virginia?", eventTitle: "Virginia Republican Senate Primary Winner", category: ForecastCategory.POLITICS },
      { question: "Will Bitcoin dip to $15,000 by December 31, 2026?", eventTitle: "What price will Bitcoin hit in 2026?", category: ForecastCategory.CRYPTO },
      { question: "Will bitcoin hit $1m before GTA VI?", eventTitle: "What will happen before GTA VI?", category: ForecastCategory.CRYPTO }
    ];
    for (const market of noisy) {
      expect(matchDeterministically({ ...market, sourceSlug: null }, clusters).kind).toBe("unmatched");
    }
  });
});
