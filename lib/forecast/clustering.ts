import type { NormalizedMarket } from "@prisma/client";
import { seedClusters, type SeedCluster } from "@/lib/config/clusters";

export function matchingSeedClusters(market: Pick<NormalizedMarket, "sourcePlatform" | "question" | "eventTitle" | "sourceSlug">): SeedCluster[] {
  const haystack = `${market.question} ${market.eventTitle} ${market.sourceSlug ?? ""}`.toLowerCase();
  return seedClusters.filter((cluster) => {
    if (cluster.match.sourcePlatform !== market.sourcePlatform) return false;
    if (cluster.match.excludeAny?.some((term) => haystack.includes(term))) return false;
    return cluster.match.includeAny.some((term) => haystack.includes(term));
  });
}
