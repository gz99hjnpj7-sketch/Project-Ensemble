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
  const rawEmb = market.embedding as any;
  if (rawEmb && (Array.isArray(rawEmb) ? rawEmb.length > 0 : Object.keys(rawEmb).length > 0)) {
    marketEmb = Array.isArray(rawEmb) ? rawEmb : (typeof rawEmb === "string" ? JSON.parse(rawEmb) : []);
  } else {
    marketEmb = await getMarketEmbedding(market);
  }

  const matches: SeedCluster[] = [];

  for (const cluster of seedClusters) {
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
): Promise<Array<{ marketId: string; similarity: number; question?: string }>> {
  if (!queryEmbedding || queryEmbedding.length === 0) return [];

  // Pure-JS cosine ranking over stored Float[] embeddings.
  // Good enough and robust (no extension dependency).
  const candidates = await prisma.normalizedMarket.findMany({
    where: { embedding: { not: null } },
    select: { id: true, question: true, embedding: true },
    take: 800
  });

  const scored = (candidates as any[])
    .map((c) => ({
      marketId: c.id,
      similarity: cosineSimilarity(queryEmbedding, c.embedding as number[]),
      question: c.question
    }))
    .filter((s) => s.similarity >= minSim)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored;
}

/**
 * Optional: semantic filter helper (used during or after fetch).
 */
export function isSemanticallyRelevant(marketEmb: number[], clusterEmbs: number[][]): boolean {
  if (!marketEmb?.length) return false;
  const best = Math.max(...clusterEmbs.map((ce) => cosineSimilarity(marketEmb, ce)));
  return best >= MIN_SIM_THRESHOLD;
}

/**
 * Dynamic event discovery (the key missing piece).
 * 
 * Takes recently embedded open markets.
 * Finds groups of markets that are semantically close to each other (> ~0.68).
 * For groups not already well-covered by existing seed clusters, 
 * asks Gemini to synthesize a title + description and creates a new ForecastCluster.
 * Links the markets into the cluster.
 *
 * This enables "gather related markets of future events" beyond the hand-written seeds.
 */
export async function discoverSemanticEvents(
  prisma: any,
  recentMarkets: Array<{ id: string; question: string; eventTitle: string; embedding: number[] | null }>,
  minGroupSize = 3,
  intraSim = 0.68
): Promise<number> {
  const { seedClusters } = await import("@/lib/config/clusters");
  const { synthesizeEventMeta, embedText } = await import("@/lib/embeddings");

  if (!recentMarkets.length) return 0;

  // Build simple groups via high intra-similarity
  const groups: string[][] = [];
  const used = new Set<string>();

  for (let i = 0; i < recentMarkets.length; i++) {
    const m1 = recentMarkets[i];
    if (!m1.embedding || used.has(m1.id)) continue;

    const group = [m1.id];
    used.add(m1.id);

    for (let j = i + 1; j < recentMarkets.length; j++) {
      const m2 = recentMarkets[j];
      if (!m2.embedding || used.has(m2.id)) continue;
      if (cosineSimilarity(m1.embedding, m2.embedding) >= intraSim) {
        group.push(m2.id);
        used.add(m2.id);
      }
    }

    if (group.length >= minGroupSize) groups.push(group);
  }

  if (groups.length === 0) return 0;

  let created = 0;

  // Precompute seed prototypes (cheap, only ~30)
  const seedPrototypes: Array<{ slug: string; emb: number[] }> = [];
  for (const seed of seedClusters) {
    try {
      const proto = `${seed.title}. ${seed.description}`;
      const emb = await embedText(proto);
      seedPrototypes.push({ slug: seed.slug, emb });
    } catch {}
  }

  for (const groupIds of groups) {
    const groupMarkets = recentMarkets.filter(m => groupIds.includes(m.id) && m.embedding);
    if (groupMarkets.length < minGroupSize) continue;

    const questions = groupMarkets.map(m => m.question);

    // Is this group already covered well by a seed?
    let covered = false;
    for (const { emb } of seedPrototypes) {
      const best = Math.max(0, ...groupMarkets.map(m => cosineSimilarity(m.embedding!, emb)));
      if (best >= 0.62) { covered = true; break; }
    }
    if (covered) continue;

    // Synthesize human readable event
    let meta;
    try {
      meta = await synthesizeEventMeta(questions);
    } catch {
      meta = { title: "Emergent Market Cluster", description: questions[0] };
    }

    const slugBase = meta.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").slice(0, 55);
    const slug = "disc-" + slugBase;

    const cluster = await prisma.forecastCluster.upsert({
      where: { slug },
      create: {
        slug,
        title: meta.title,
        category: "OTHER" as any,
        description: meta.description
      },
      update: { title: meta.title, description: meta.description }
    });

    for (const m of groupMarkets) {
      await prisma.clusterMarket.upsert({
        where: { clusterId_marketId: { clusterId: cluster.id, marketId: m.id } },
        create: {
          clusterId: cluster.id,
          marketId: m.id,
          sourcePlatform: "POLYMARKET" as any,
          relationship: "semantic"
        },
        update: {}
      });
    }

    created += 1;
  }

  return created;
}
