import type { ForecastCategory, SourcePlatform } from "@prisma/client";
import { seedClusters, type SeedCluster } from "@/lib/config/clusters";

export type MatchableMarket = {
  sourcePlatform: SourcePlatform;
  question: string;
  eventTitle?: string | null;
  sourceSlug?: string | null;
  category?: ForecastCategory | null;
};

type ClusterRule = {
  slug: string;
  category?: ForecastCategory;
  any: RegExp[];
  none?: RegExp[];
};

const rules: ClusterRule[] = [
  {
    slug: "fed-rate-path",
    category: "MACRO" as ForecastCategory,
    any: [/\bfed\b/i, /\bfomc\b/i, /federal reserve/i, /interest rate/i, /rate cut/i, /rate hike/i]
  },
  {
    slug: "us-inflation-cpi",
    category: "MACRO" as ForecastCategory,
    any: [/\bcpi\b/i, /inflation/i, /core pce/i, /headline pce/i]
  },
  {
    slug: "us-recession",
    category: "MACRO" as ForecastCategory,
    any: [/recession/i, /gdp contraction/i]
  },
  {
    slug: "unemployment-rate",
    category: "MACRO" as ForecastCategory,
    any: [/unemployment/i, /jobless/i, /labor market/i]
  },
  {
    slug: "us-senate-control",
    category: "POLITICS" as ForecastCategory,
    any: [/senate/i, /senate majority/i]
  },
  {
    slug: "us-house-control",
    category: "POLITICS" as ForecastCategory,
    any: [/house majority/i, /house of representatives/i]
  },
  {
    slug: "us-election-2026-midterms",
    category: "POLITICS" as ForecastCategory,
    any: [/midterm/i, /congress control/i, /control of congress/i]
  },
  {
    slug: "us-presidential-election",
    category: "POLITICS" as ForecastCategory,
    any: [/presidential election/i, /president in 2028/i, /democratic nominee/i, /republican nominee/i]
  },
  {
    slug: "uk-general-election",
    category: "POLITICS" as ForecastCategory,
    any: [/uk general election/i, /british general election/i, /\blabour\b/i, /\bconservative\b/i, /reform uk/i]
  },
  {
    slug: "bitcoin-price",
    category: "CRYPTO" as ForecastCategory,
    any: [/\bbitcoin\b/i, /\bbtc\b/i]
  },
  {
    slug: "ethereum-etf",
    category: "CRYPTO" as ForecastCategory,
    any: [/\bethereum\b/i, /\beth\b/i, /ether etf/i]
  },
  {
    slug: "solana-ecosystem",
    category: "CRYPTO" as ForecastCategory,
    any: [/\bsolana\b/i, /\bsol\b/i]
  },
  {
    slug: "ukraine-ceasefire",
    category: "WORLD" as ForecastCategory,
    any: [/ukraine/i, /russia.*ceasefire/i, /ceasefire.*russia/i]
  },
  {
    slug: "taiwan-conflict",
    category: "WORLD" as ForecastCategory,
    any: [/taiwan/i, /china.*invasion/i]
  },
  {
    slug: "starship-flights",
    category: "WORLD" as ForecastCategory,
    any: [/starship/i, /spacex/i]
  },
  {
    slug: "oil-price",
    category: "MACRO" as ForecastCategory,
    any: [/\boil\b/i, /\bbrent\b/i, /\bwti\b/i]
  },
  {
    slug: "china-gdp-growth",
    category: "MACRO" as ForecastCategory,
    any: [/china.*gdp/i, /chinese.*growth/i]
  },
  {
    slug: "next-frontier-llm",
    category: "OTHER" as ForecastCategory,
    any: [/\bgpt-?5\b/i, /\bclaude\b/i, /\bgemini\b/i, /\bgrok\b/i, /frontier model/i]
  },
  {
    slug: "agi-timelines",
    category: "OTHER" as ForecastCategory,
    any: [/\bagi\b/i, /artificial general intelligence/i]
  },
  {
    slug: "robotaxi-launch",
    category: "OTHER" as ForecastCategory,
    any: [/robotaxi/i, /autonomous vehicle/i, /self-driving/i]
  }
];

export function matchMarketToSeedCluster(market: MatchableMarket): SeedCluster | null {
  const haystack = normalize(`${market.question} ${market.eventTitle ?? ""} ${market.sourceSlug ?? ""}`);

  for (const rule of rules) {
    if (rule.category && market.category && rule.category !== market.category) continue;
    if (rule.none?.some((pattern) => pattern.test(haystack))) continue;
    if (!rule.any.some((pattern) => pattern.test(haystack))) continue;

    return seedClusters.find((cluster) => cluster.slug === rule.slug) ?? null;
  }

  return null;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
