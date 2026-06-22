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
      includeAny: [
        "presidential election winner 2028",
        "democratic presidential nominee",
        "republican presidential nominee",
        "presidential nominee 2028",
        "2028 presidential election",
        "election winner 2028"
      ],
      excludeAny: ["approval rating", "primary"]
    }
  },
  {
    slug: "us-congress-control",
    title: "US Congress Control",
    category: ForecastCategory.POLITICS,
    description: "Markets about Senate, House, and congressional control.",
    match: {
      sourcePlatform: SourcePlatform.POLYMARKET,
      includeAny: ["senate", "house", "congress", "congressional", "control the house", "control the senate"]
    }
  },
  {
    slug: "fed-rate-path",
    title: "Fed Rate Path",
    category: ForecastCategory.MACRO,
    description: "Markets about Federal Reserve rate decisions and rate cuts.",
    match: {
      sourcePlatform: SourcePlatform.POLYMARKET,
      includeAny: ["fed", "federal reserve", "rate cut", "interest rate", "fomc", "will the fed", "fed rate"]
    }
  },
  {
    slug: "inflation-cpi",
    title: "Inflation and CPI",
    category: ForecastCategory.MACRO,
    description: "Markets about inflation releases and CPI outcomes.",
    match: {
      sourcePlatform: SourcePlatform.POLYMARKET,
      includeAny: ["inflation", "cpi", "consumer price", "inflation rate", "core cpi"]
    }
  },
  {
    slug: "recession-risk",
    title: "Recession Risk",
    category: ForecastCategory.MACRO,
    description: "Markets about recession, GDP contraction, and labor market stress.",
    match: {
      sourcePlatform: SourcePlatform.POLYMARKET,
      includeAny: ["recession", "gdp", "unemployment", "jobs report", "recession odds", "gdp growth"]
    }
  }
];
