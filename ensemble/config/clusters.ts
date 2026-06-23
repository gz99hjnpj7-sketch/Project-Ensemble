import { ForecastCategory } from "@prisma/client";

export type SeedCluster = {
  slug: string;
  title: string;
  category: ForecastCategory;
  description: string;
  rule: ClusterRule;
};

export type ClusterTargetMetric =
  | "presidential-winner-2028"
  | "at-least-one-fed-cut-2026"
  | "democratic-congress-control-2026"
  | "frontier-ai-release"
  | "bitcoin-upside-2026";

export type ClusterRule = {
  targetMetric: ClusterTargetMetric;
  includePatterns: RegExp[];
  excludePatterns?: RegExp[];
};

export const seedClusters: SeedCluster[] = [
  {
    slug: "us-presidential-2028",
    title: "US Presidential Election 2028",
    category: ForecastCategory.POLITICS,
    description: "Who wins the 2028 US presidential election. Nomination markets are kept out for now.",
    rule: {
      targetMetric: "presidential-winner-2028",
      includePatterns: [/\b2028\b.*\b(us )?presidential election\b/i, /\bpresidential election winner 2028\b/i],
      excludePatterns: [/\bnomination\b/i, /\bnominee\b/i, /\bprimary\b/i, /\blebron james\b/i, /\bkim kardashian\b/i, /\bstephen smith\b/i, /\bjalen brunson\b/i]
    }
  },
  {
    slug: "fed-rate-path",
    title: "Federal Reserve Rate Cut Odds",
    category: ForecastCategory.MACRO,
    description: "Whether the Fed cuts rates in 2026. Cut-count ladder markets are included and normalized.",
    rule: {
      targetMetric: "at-least-one-fed-cut-2026",
      includePatterns: [
        /\bfed(?:eral reserve)?\b.*\brate cuts?\b.*\b2026\b/i,
        /\bhow many fed rate cuts in 2026\b/i,
        /\bwill \d+ fed rate cuts happen in 2026\b/i,
        /\bwill 12 or more fed rate cuts happen in 2026\b/i,
        /\bno fed rate cuts happen in 2026\b/i
      ],
      excludePatterns: [/\bfedex\b/i, /\brate hike\b/i, /\bupper bound\b/i, /\blower bound\b/i, /\bno change\b/i]
    }
  },
  {
    slug: "us-2026-midterms",
    title: "US House Control 2026",
    category: ForecastCategory.POLITICS,
    description: "Whether Democrats control the House after the 2026 midterm elections.",
    rule: {
      targetMetric: "democratic-congress-control-2026",
      includePatterns: [
        /\bwhich party will win the house in 2026\b/i,
        /\bcontrol the house after the 2026 midterm/i,
        /\b2026 balance of power:\s*(d|r) senate,\s*d house\b/i
      ],
      excludePatterns: [/\bprimary\b/i, /\bnominee\b/i, /\bgovernor(ship)?\b/i, /\bwhich party will win the senate in 2026\b/i, /\bcontrol the senate after the 2026 midterm/i, /\bsenate seats\b/i, /\b2026 balance of power:\s*(d|r) senate,\s*r house\b/i]
    }
  },
  {
    slug: "frontier-ai-timeline",
    title: "OpenAI Frontier Model by Sep. 30, 2026",
    category: ForecastCategory.OTHER,
    description: "Whether OpenAI releases a new frontier model on or before September 30, 2026.",
    rule: {
      targetMetric: "frontier-ai-release",
      includePatterns: [/\bopenai\b.*\brelease a new frontier model\b.*\bseptember 30, 2026\b/i],
      excludePatterns: [/\bbest ai model\b/i, /\bagi\b/i, /\bclaude\b/i, /\bgemini\b/i, /\bgpt[- ]?6\b/i]
    }
  },
  {
    slug: "bitcoin-price",
    title: "Bitcoin $100k by Dec. 31, 2026",
    category: ForecastCategory.CRYPTO,
    description: "Whether Bitcoin reaches $100,000 by December 31, 2026.",
    rule: {
      targetMetric: "bitcoin-upside-2026",
      includePatterns: [/\bbitcoin\b.*\breach \$?100,?000\b.*\bdecember 31, 2026\b/i],
      excludePatterns: [/\bdip\b/i, /\bbefore gta vi\b/i, /\bsatoshi\b/i, /\$?(90,?000|110,?000|120,?000|130,?000|140,?000|150,?000|160,?000|170,?000|180,?000|190,?000|200,?000|250,?000|150k)\b/i]
    }
  }
];
