import { ForecastCategory, SourcePlatform } from "@prisma/client";

export type SeedCluster = {
  slug: string;
  title: string;
  category: ForecastCategory;
  description: string;
  // NOTE: keyword `match` is deprecated. Semantic embedding matching on title+description is now used entirely.
  match?: {
    sourcePlatform: SourcePlatform;
    includeAny?: string[];
    excludeAny?: string[];
  };
  weightOverride?: number;
};

export const seedClusters: SeedCluster[] = [
  {
    slug: "us-presidential-election",
    title: "US Presidential Election",
    category: ForecastCategory.POLITICS,
    description: "Major prediction markets about the next US presidential election, nominees for Democratic and Republican parties, 2028 election winner, frontrunners for nomination.",
    // Semantic matching now used (embed(title + description)). Keywords kept only as hints.
    match: {
      sourcePlatform: SourcePlatform.POLYMARKET,
      includeAny: ["presidential", "nominee", "election 2028"],
      excludeAny: ["approval rating"]
    }
  },
  {
    slug: "us-congress-control",
    title: "US Congress Control",
    category: ForecastCategory.POLITICS,
    description: "Markets about which party will control the US Senate, House of Representatives, or overall Congress. Includes majority control, congressional elections.",
    match: {
      sourcePlatform: SourcePlatform.POLYMARKET,
      includeAny: ["senate", "house", "congress", "congressional", "majority"]
    }
  },
  {
    slug: "fed-rate-path",
    title: "Fed Rate Path",
    category: ForecastCategory.MACRO,
    description: "Markets about Federal Reserve interest rate decisions, FOMC meetings, rate cuts, fed funds rate path, monetary policy.",
    match: {
      sourcePlatform: SourcePlatform.POLYMARKET,
      includeAny: ["fed", "federal reserve", "rate cut", "fomc", "interest rate"]
    }
  },
  {
    slug: "inflation-cpi",
    title: "Inflation and CPI",
    category: ForecastCategory.MACRO,
    description: "Markets about US inflation, CPI prints, core CPI, consumer price index releases and inflation rate outcomes.",
    match: {
      sourcePlatform: SourcePlatform.POLYMARKET,
      includeAny: ["inflation", "cpi", "consumer price", "inflation rate"]
    }
  },
  {
    slug: "recession-risk",
    title: "Recession Risk",
    category: ForecastCategory.MACRO,
    description: "Markets about recession odds, GDP growth or contraction, unemployment rate, jobs reports, and labor market indicators.",
    match: {
      sourcePlatform: SourcePlatform.POLYMARKET,
      includeAny: ["recession", "gdp", "unemployment", "jobs"]
    }
  }
];
