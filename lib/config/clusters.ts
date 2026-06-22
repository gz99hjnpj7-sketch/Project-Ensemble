import { ForecastCategory } from "@prisma/client";

export type SeedCluster = {
  slug: string;
  title: string;
  category: ForecastCategory;
  description: string;
  weightOverride?: number;
};

/**
 * High-quality deterministic seed clusters.
 * Processing rules in lib/processing/matcher.ts map source markets to these
 * clusters without AI or external embedding calls.
 */
export const seedClusters: SeedCluster[] = [
  // === POLITICS ===
  {
    slug: "us-presidential-election",
    title: "US Presidential Election 2028",
    category: ForecastCategory.POLITICS,
    description: "Prediction markets on the winner of the 2028 US presidential election, Democratic and Republican nominees, primary frontrunners, candidate odds, and US politics election party control."
  },
  {
    slug: "us-senate-control",
    title: "US Senate Majority Control",
    category: ForecastCategory.POLITICS,
    description: "Markets forecasting which party will control the US Senate after the next election (2026 or 2028 midterms), majority party in Senate, US congressional control politics."
  },
  {
    slug: "us-house-control",
    title: "US House of Representatives Control",
    category: ForecastCategory.POLITICS,
    description: "Markets on which party will hold the majority in the US House of Representatives after midterms, key House races, US congressional politics control."
  },
  {
    slug: "uk-general-election",
    title: "UK General Election",
    category: ForecastCategory.POLITICS,
    description: "Markets on the next UK general election winner, seat counts for Labour, Conservatives, Liberal Democrats, and Reform UK."
  },

  // === MACRO / RATES / INFLATION ===
  {
    slug: "fed-rate-path",
    title: "Federal Reserve Interest Rate Path",
    category: ForecastCategory.MACRO,
    description: "US Federal Reserve FOMC interest rate decisions, federal funds target range after specific meetings, expected number of rate cuts this year and terminal rate level. Economic policy only."
  },
  {
    slug: "ecb-rate-path",
    title: "ECB Interest Rate Decisions",
    category: ForecastCategory.MACRO,
    description: "Markets about European Central Bank deposit facility rate cuts, hikes, and policy path for the euro area."
  },
  {
    slug: "us-inflation-cpi",
    title: "US Inflation and CPI Outcomes",
    category: ForecastCategory.MACRO,
    description: "US economic data: headline CPI, core CPI month-over-month or YoY prints, PCE inflation rate outcomes. Pure macro inflation statistics, not sports or other events."
  },
  {
    slug: "us-recession",
    title: "US Recession Probability",
    category: ForecastCategory.MACRO,
    description: "US macro economy: probability of recession within 12 months per GDP contraction, unemployment rate, labor market stress indicators. Economic statistics only."
  },
  {
    slug: "unemployment-rate",
    title: "US Unemployment Rate",
    category: ForecastCategory.MACRO,
    description: "Markets forecasting the US unemployment rate at specific dates or whether it will rise above certain thresholds."
  },

  // === CRYPTO ===
  {
    slug: "bitcoin-price",
    title: "Bitcoin Price Milestones",
    category: ForecastCategory.CRYPTO,
    description: "Markets on Bitcoin reaching certain price levels (e.g. $100k, $150k) by specific dates, ETF flows, and year-end closes."
  },
  {
    slug: "ethereum-etf",
    title: "Ethereum ETF and Staking Outcomes",
    category: ForecastCategory.CRYPTO,
    description: "Markets on Ethereum spot ETF approvals, inflows, and staking related events."
  },
  {
    slug: "solana-ecosystem",
    title: "Solana Price and Ecosystem Events",
    category: ForecastCategory.CRYPTO,
    description: "Markets on SOL price milestones, network upgrades, and major Solana ecosystem developments."
  },

  // === AI / TECH TIMELINES ===
  {
    slug: "next-frontier-llm",
    title: "Next Major Frontier AI Model Releases",
    category: ForecastCategory.OTHER,
    description: "Markets on release dates for GPT-5 / o3, Claude 4, Gemini 2.5, Grok 3/4 and other major foundation model launches."
  },
  {
    slug: "agi-timelines",
    title: "AGI Arrival Timelines",
    category: ForecastCategory.OTHER,
    description: "Markets on when transformative AGI or high-level machine intelligence will be achieved according to various definitions (2025-2032)."
  },
  {
    slug: "ai-regulation",
    title: "AI Regulation and Policy Milestones",
    category: ForecastCategory.POLITICS,
    description: "Markets on passage of major AI safety or regulation bills in US, EU (AI Act enforcement), UK, and China."
  },
  {
    slug: "ai-scaling-laws",
    title: "AI Compute and Scaling Milestones",
    category: ForecastCategory.OTHER,
    description: "Markets on training runs exceeding certain FLOP thresholds, largest clusters, and related scaling events."
  },

  // === SPACE / ENERGY ===
  {
    slug: "starship-flights",
    title: "SpaceX Starship Flight and Milestone Timeline",
    category: ForecastCategory.WORLD,
    description: "Markets on Starship orbital attempts, booster catches, crewed flights, and NASA/Artemis related timelines."
  },
  {
    slug: "artemis-moon",
    title: "Artemis Program and Crewed Moon Landing",
    category: ForecastCategory.WORLD,
    description: "Markets on the date of the first crewed Artemis mission to the Moon and related milestones."
  },
  {
    slug: "nuclear-fusion",
    title: "Nuclear Fusion Net Energy and Commercial Milestones",
    category: ForecastCategory.OTHER,
    description: "Markets on when fusion experiments achieve scientific breakeven repeatedly or first commercial power milestones."
  },

  // === GEOPOLITICS / GLOBAL ===
  {
    slug: "taiwan-conflict",
    title: "Taiwan Conflict or Invasion Odds",
    category: ForecastCategory.WORLD,
    description: "Markets on the probability of major military conflict involving Taiwan and China in the next 1-5 years."
  },
  {
    slug: "ukraine-ceasefire",
    title: "Ukraine-Russia War Ceasefire or Resolution",
    category: ForecastCategory.WORLD,
    description: "Markets on dates for ceasefire agreements, territorial control outcomes, or end of active hostilities in Ukraine."
  },
  {
    slug: "oil-price",
    title: "Oil Price (Brent/WTI) Levels",
    category: ForecastCategory.MACRO,
    description: "Markets forecasting Brent or WTI crude prices at future dates and major supply disruption events."
  },
  {
    slug: "china-gdp-growth",
    title: "China GDP Growth Rate",
    category: ForecastCategory.MACRO,
    description: "Markets on official and shadow estimates of China real GDP growth for the current and next year."
  },

  // === TECH / SOCIETY ===
  {
    slug: "robotaxi-launch",
    title: "Robotaxi and Autonomous Vehicle Commercial Launch",
    category: ForecastCategory.OTHER,
    description: "Markets on when unsupervised robotaxis launch at scale in major cities (Tesla, Waymo, Cruise, etc.)."
  },
  {
    slug: "us-election-2026-midterms",
    title: "2026 US Midterm Elections",
    category: ForecastCategory.POLITICS,
    description: "Markets on control of Congress after the 2026 midterms and key Senate/House race outcomes."
  },
  {
    slug: "crypto-regulation-us",
    title: "US Crypto Regulation and Legislation",
    category: ForecastCategory.POLITICS,
    description: "Markets on passage of major US crypto market structure, stablecoin, or Bitcoin strategic reserve legislation."
  }
];
