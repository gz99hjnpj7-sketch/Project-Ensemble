import type { ForecastCluster, NormalizedMarket } from "@prisma/client";

type MatchableMarket = Pick<NormalizedMarket, "question" | "eventTitle" | "sourceSlug" | "category">;
type MatchableCluster = Pick<ForecastCluster, "id" | "slug" | "category" | "title" | "description">;

const hints: Record<string, string[]> = {
  "fed-rate-path": ["fed", "fomc", "rate cut", "interest rate", "federal reserve"],
  "us-inflation-cpi": ["inflation", "cpi", "pce"],
  "us-presidential-election": ["presidential election", "president", "nominee", "nomination"],
  "us-senate-control": ["senate", "senate majority"],
  "us-house-control": ["house majority", "house of representatives", "congress control"],
  "bitcoin-price": ["bitcoin", "btc"]
};

export function matchDeterministically(market: MatchableMarket, clusters: MatchableCluster[]) {
  const haystack = `${market.question} ${market.eventTitle} ${market.sourceSlug ?? ""}`.toLowerCase();
  let best: { cluster: MatchableCluster; hits: number; hint: string } | null = null;
  for (const cluster of clusters) {
    const clusterHints = hints[cluster.slug] ?? wordsFromCluster(cluster);
    const matches = clusterHints.filter((hint) => haystack.includes(hint.toLowerCase()));
    if (matches.length && (!best || matches.length > best.hits)) best = { cluster, hits: matches.length, hint: matches[0] };
  }
  if (!best) return { kind: "unmatched" as const, confidence: 0 as const, method: "deterministic" as const, reason: "No deterministic seed hints matched this market." };
  return { kind: "matched" as const, clusterId: best.cluster.id, confidence: Math.min(0.95, 0.65 + best.hits * 0.1), method: "deterministic" as const, reason: `Matched seed hint: ${best.hint}` };
}

function wordsFromCluster(cluster: MatchableCluster): string[] {
  return `${cluster.title} ${cluster.description ?? ""}`.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 5).slice(0, 4);
}
