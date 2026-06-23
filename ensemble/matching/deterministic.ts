import type { ForecastCluster, NormalizedMarket } from "@prisma/client";
import { seedClusters } from "@/ensemble/config/clusters";

type MatchableMarket = Pick<NormalizedMarket, "question" | "eventTitle" | "sourceSlug" | "category">;
type MatchableCluster = Pick<ForecastCluster, "id" | "slug" | "category" | "title" | "description">;

const rulesBySlug = new Map(seedClusters.map((cluster) => [cluster.slug, cluster.rule]));

export function matchDeterministically(market: MatchableMarket, clusters: MatchableCluster[]) {
  const haystack = `${market.question} ${market.eventTitle} ${market.sourceSlug ?? ""}`.toLowerCase();
  let best: { cluster: MatchableCluster; score: number; reason: string } | null = null;
  for (const cluster of clusters) {
    if (cluster.category !== market.category) continue;
    const rule = rulesBySlug.get(cluster.slug);
    if (!rule) continue;
    const scored = scoreRule(haystack, rule);
    if (scored.score > 0 && (!best || scored.score > best.score)) best = { cluster, score: scored.score, reason: scored.reason };
  }
  if (!best) return { kind: "unmatched" as const, confidence: 0 as const, method: "deterministic" as const, reason: "No deterministic seed hints matched this market." };
  return {
    kind: "matched" as const,
    clusterId: best.cluster.id,
    confidence: Math.min(0.95, 0.7 + best.score * 0.08),
    method: "deterministic" as const,
    reason: best.reason,
    requiresInversion: requiresInversionForCluster(best.cluster.slug, haystack)
  };
}

function scoreRule(haystack: string, rule: { includePatterns: RegExp[]; excludePatterns?: RegExp[] }) {
  if (rule.excludePatterns?.some((pattern) => pattern.test(haystack))) {
    return { score: 0, reason: "Excluded by cluster guardrail" };
  }
  const hits = rule.includePatterns.filter((pattern) => pattern.test(haystack));
  return { score: hits.length, reason: hits[0] ? `Matched rule: ${hits[0].source}` : "No deterministic seed rules matched this market." };
}

function requiresInversionForCluster(slug: string, haystack: string): boolean {
  if (slug === "fed-rate-path") return /\bno fed rate cuts?\b/i.test(haystack);
  if (slug === "us-2026-midterms") {
    return /republican party control the house after the 2026/i.test(haystack);
  }
  return false;
}
