import { ForecastCategory } from "@prisma/client";

export type SeedCluster = {
  slug: string;
  title: string;
  category: ForecastCategory;
  description: string;
  deterministicHints: string[];
  blockedHints?: string[];
};

export const seedClusters: SeedCluster[] = [
  {
    slug: "us-presidential-2028",
    title: "US Presidential Election 2028",
    category: ForecastCategory.POLITICS,
    description: "Who wins the 2028 US presidential election. Nomination markets are kept out for now.",
    deterministicHints: ["2028 us presidential election", "2028 presidential election", "presidential election winner 2028"],
    blockedHints: ["nomination", "nominee"]
  },
  {
    slug: "fed-rate-path",
    title: "Federal Reserve Rate Cut Odds",
    category: ForecastCategory.MACRO,
    description: "Whether the Fed cuts rates in 2026. Detailed rate-level and hike markets are kept out for now.",
    deterministicHints: ["no fed rate cuts"],
    blockedHints: ["fedex", "no change", "rate hike", "upper bound", "lower bound"]
  },
  {
    slug: "us-2026-midterms",
    title: "US 2026 House Control",
    category: ForecastCategory.POLITICS,
    description: "Whether Democrats control the House after the 2026 midterm elections.",
    deterministicHints: ["democratic party control the house after the 2026", "republican party control the house after the 2026"],
    blockedHints: ["senate", "balance of power", "governorship", "senate seats"]
  },
  {
    slug: "frontier-ai-timeline",
    title: "Frontier AI Timeline",
    category: ForecastCategory.OTHER,
    description: "Major AI model releases and capability milestones, without LLM-generated classification or synthesis.",
    deterministicHints: ["gpt-5", "gpt 5", "gpt-5.6", "gpt-6", "gpt 6", "claude 4", "gemini 2.5", "frontier model", "agi", "artificial general intelligence"],
    blockedHints: ["best ai model at the end of june", "#1 ai model by june"]
  },
  {
    slug: "bitcoin-price",
    title: "Bitcoin $100K by End of 2026",
    category: ForecastCategory.CRYPTO,
    description: "Whether Bitcoin reaches $100,000 by December 31, 2026.",
    deterministicHints: ["bitcoin reach $100,000 by december 31, 2026", "bitcoin reach 100000 by december 31, 2026"],
    blockedHints: ["dip", "june", "before gta vi", "$250,000", "$67,500", "$90,000"]
  }
];
