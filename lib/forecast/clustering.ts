import type { NormalizedMarket } from "@prisma/client";
import { seedClusters, type SeedCluster } from "@/lib/config/clusters";
import { embedText, cosineSimilarity, MIN_SIM_THRESHOLD } from "@/lib/embeddings";
export { cosineSimilarity } from "@/lib/embeddings";
export { MIN_SIM_THRESHOLD } from "@/lib/embeddings";

// In-memory cache for cluster prototype embeddings (tiny number of clusters).
// All keyword matching has been removed; everything is now embedding + cosine.
const clusterEmbeddingCache = new Map<string, number[]>();

/**
 * Get or compute the semantic embedding for a cluster using its title + description.
 * This replaces all keyword matching.
 */
export async function getClusterEmbedding(cluster: SeedCluster): Promise<number[]> {
  if (clusterEmbeddingCache.has(cluster.slug)) {
    return clusterEmbeddingCache.get(cluster.slug)!;
  }
  const prototype = `${cluster.title}. ${cluster.description}`;
  const emb = await embedText(prototype);
  clusterEmbeddingCache.set(cluster.slug, emb);
  return emb;
}

/**
 * Compute embedding for a market (question + eventTitle is the primary signal).
 * Caches not needed here (called per market on ingest).
 */
export async function getMarketEmbedding(
  market: Pick<NormalizedMarket, "question" | "eventTitle">
): Promise<number[]> {
  const text = `${market.question} ${market.eventTitle ?? ""}`.trim();
  return embedText(text);
}

/**
 * Pure semantic matching using embeddings + cosine similarity.
 * Replaces the old keyword includeAny/excludeAny logic entirely.
 *
 * Returns clusters whose prototype embedding is similar enough to the market embedding.
 * Always respects sourcePlatform when present in old seed definition.
 */
export async function matchingSeedClustersSemantic(
  market: Pick<NormalizedMarket, "sourcePlatform" | "question" | "eventTitle" | "sourceSlug"> & { embedding?: number[] | null }
): Promise<SeedCluster[]> {
  const platform = market.sourcePlatform;

  // Use precomputed embedding if provided on the market object, else generate.
  let marketEmb: number[];
  if (market.embedding && market.embedding.length > 0) {
    marketEmb = market.embedding;
  } else {
    marketEmb = await getMarketEmbedding(market);
  }

  const matches: SeedCluster[] = [];

  for (const cluster of seedClusters) {
    // Respect platform filter if the legacy match block still specifies one (optional)
    const expectedPlatform = cluster.match?.sourcePlatform;
    if (expectedPlatform && expectedPlatform !== platform) continue;

    const clusterEmb = await getClusterEmbedding(cluster);
    const sim = cosineSimilarity(marketEmb, clusterEmb);

    if (sim >= MIN_SIM_THRESHOLD) {
      matches.push(cluster);
    }
  }

  return matches;
}

// Backwards-compatible name used by ingestion. Now delegates to semantic version.
export const matchingSeedClusters = matchingSeedClustersSemantic;

/**
 * Vector search helper: given a query embedding, find most similar markets using
 * raw SQL cosine distance via pgvector (if embeddings column populated).
 * Returns array of { marketId, similarity }
 */
export async function findSimilarMarkets(
  prisma: any,
  queryEmbedding: number[],
  limit = 20,
  minSim = MIN_SIM_THRESHOLD
): Promise<Array<{ marketId: string; similarity: number }>> {
  if (!queryEmbedding || queryEmbedding.length === 0) return [];

  // Use <=> for cosine distance (1 - cosine sim) with pgvector
  // We convert to similarity = 1 - distance
  const rows = await prisma.$queryRaw<Array<{ id: string; distance: number }>>`
    SELECT id, embedding <=> ${queryEmbedding}::vector AS distance
    FROM "NormalizedMarket"
    WHERE embedding IS NOT NULL
    ORDER BY distance ASC
    LIMIT ${limit};
  `;

  return (rows as Array<{ id: string; distance: number }>)
    .map((r) => ({ marketId: r.id, similarity: 1 - r.distance }))
    .filter((r) => r.similarity >= minSim);
}

/**
 * Optional: semantic filter helper (used during or after fetch).
 */
export function isSemanticallyRelevant(marketEmb: number[], clusterEmbs: number[][]): boolean {
  if (!marketEmb?.length) return false;
  const best = Math.max(...clusterEmbs.map((ce) => cosineSimilarity(marketEmb, ce)));
  return best >= MIN_SIM_THRESHOLD;
}
