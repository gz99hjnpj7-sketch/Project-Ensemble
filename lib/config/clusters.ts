import { ForecastCategory, SourcePlatform } from "@prisma/client";

export type SeedCluster = {
  slug: string;
  title: string;
  category: ForecastCategory;
  description: string;
  match: {
    sourcePlatform: SourcePlatform;
    includeAny: string[];
    excludeAny?: string[];
  };
  weightOverride?: number;
};

export const seedClusters: SeedCluster[] = [
  {
    slug: "us-presidential-election",
    title: "US Presidential Election",
    category: ForecastCategory.POLITICS,
    description: "Major markets about the next US presidential race.",
    match: {
      sourcePlatform: SourcePlatform.POLYMARKET,
      includeAny: ["2028 us presidential election", "2028 presidential election", "win the 2028 us presidential election"],
      excludeAny: ["approval rating", "nomination", "nominee", "primary"]
    }
  },
  {
    slug: "us-congress-control",
    title: "US Congress Control",
    category: ForecastCategory.POLITICS,
    description: "Markets about Senate, House, and congressional control.",
    match: {
      sourcePlatform: SourcePlatform.POLYMARKET,
      includeAny: ["senate", "house", "congress", "congressional"]
    }
  },
  {
    slug: "fed-rate-path",
    title: "Fed Rate Path",
    category: ForecastCategory.MACRO,
    description: "Markets about Federal Reserve rate decisions and rate cuts.",
    match: {
      sourcePlatform: SourcePlatform.POLYMARKET,
      includeAny: ["fed", "federal reserve", "rate cut", "interest rate", "fomc"]
    }
  },
  {
    slug: "inflation-cpi",
    title: "Inflation and CPI",
    category: ForecastCategory.MACRO,
    description: "Markets about inflation releases and CPI outcomes.",
    match: {
      sourcePlatform: SourcePlatform.POLYMARKET,
      includeAny: ["inflation", "cpi", "consumer price"]
    }
  },
  {
    slug: "recession-risk",
    title: "Recession Risk",
    category: ForecastCategory.MACRO,
    description: "Markets about recession, GDP contraction, and labor market stress.",
    match: {
      sourcePlatform: SourcePlatform.POLYMARKET,
      includeAny: ["recession", "gdp", "unemployment", "jobs report"]
    }
  }
];
