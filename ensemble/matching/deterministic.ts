import type { ForecastCluster, NormalizedMarket } from "@prisma/client";
import { seedClusters } from "@/ensemble/config/clusters";

type MatchableMarket = Pick<NormalizedMarket, "question" | "eventTitle" | "sourceSlug" | "category">;
type MatchableCluster = Pick<ForecastCluster, "id" | "slug" | "category" | "title" | "description">;

const hintsBySlug = new Map(seedClusters.map((cluster) => [cluster.slug, cluster.deterministicHints]));
const blockedHintsBySlug = new Map(seedClusters.map((cluster) => [cluster.slug, cluster.blockedHints ?? []]));

export function matchDeterministically(market: MatchableMarket, clusters: MatchableCluster[]) {
  const haystack = `${market.question} ${market.eventTitle} ${market.sourceSlug ?? ""}`.toLowerCase();
  let best: { cluster: MatchableCluster; hits: number; hint: string } | null = null;
  for (const cluster of clusters) {
    const clusterHints = hintsBySlug.get(cluster.slug) ?? [];
    const blockedHints = blockedHintsBySlug.get(cluster.slug) ?? [];
    if (blockedHints.some((hint) => haystack.includes(hint.toLowerCase()))) continue;
    const matches = clusterHints.filter((hint) => haystack.includes(hint.toLowerCase()));
    if (matches.length && (!best || matches.length > best.hits)) best = { cluster, hits: matches.length, hint: matches[0] };
  }
  if (!best) return { kind: "unmatched" as const, confidence: 0 as const, method: "deterministic" as const, reason: "No deterministic seed hints matched this market." };
  return { kind: "matched" as const, clusterId: best.cluster.id, confidence: Math.min(0.95, 0.65 + best.hits * 0.1), method: "deterministic" as const, reason: `Matched seed hint: ${best.hint}` };
}
