import { MatchOutcome, type Prisma, type PrismaClient } from "@prisma/client";
import type { NormalizedMarketInput } from "@/ensemble/connectors/types";
import type { MatchResult } from "@/ensemble/matching/types";
import { toPrismaMatchMethod } from "@/ensemble/matching/types";
import { detectSignalWarnings } from "@/ensemble/quality/anomalies";
import { computeQualityScore } from "@/ensemble/quality/score";

export async function persistMarketObservation(db: PrismaClient, input: NormalizedMarketInput, runId: string, match: MatchResult, now: Date) {
  const { observedAt, embedding, ...marketData } = input;
  const market = await db.normalizedMarket.upsert({
    where: { sourcePlatform_sourceMarketId: { sourcePlatform: input.sourcePlatform, sourceMarketId: input.sourceMarketId } },
    create: { ...marketData, embedding: embedding as Prisma.InputJsonValue | undefined, rawPayload: input.rawPayload as object },
    update: { ...marketData, embedding: embedding as Prisma.InputJsonValue | undefined, rawPayload: input.rawPayload as object }
  });
  const snapshot = await db.marketSnapshot.create({
    data: { marketId: market.id, ingestionRunId: runId, sourcePlatform: input.sourcePlatform, observedAt: observedAt ?? now, currentProbability: input.currentProbability, bid: input.bid, ask: input.ask, midpoint: input.midpoint, volume: input.volume, liquidity: input.liquidity, openInterest: input.openInterest, tradeCount: input.tradeCount, participantCount: input.participantCount, rawPayload: input.rawPayload as object }
  });
  const quality = computeQualityScore({ ...input, createdAt: market.createdAt }, now);
  await db.marketQualityScore.create({ data: { marketId: market.id, score: quality.score, confidence: quality.confidence, flags: quality.flags, liquidityScore: quality.liquidityScore, spreadScore: quality.spreadScore, volumeScore: quality.volumeScore, recencyScore: quality.recencyScore, marketAgeScore: quality.marketAgeScore, computedAt: now } });
  const previous24h = await db.marketSnapshot.findFirst({ where: { marketId: market.id, observedAt: { lte: new Date(now.getTime() - 23 * 3_600_000) } }, orderBy: { observedAt: "desc" } });
  const warnings = detectSignalWarnings(snapshot, previous24h, input.lastUpdated, now);
  if (warnings.length) {
    await db.signalWarning.createMany({ data: warnings.map((warning) => ({ marketId: market.id, sourcePlatform: input.sourcePlatform, type: warning.type, message: warning.message, severity: warning.severity, observedAt: now, metadata: warning.metadata as Prisma.InputJsonValue })) });
  }
  await db.matchDecision.create({ data: { marketId: market.id, clusterId: match.kind === "matched" ? match.clusterId : null, outcome: match.kind === "matched" ? MatchOutcome.MATCHED : MatchOutcome.UNMATCHED, method: toPrismaMatchMethod(match.method), confidence: match.confidence, reason: match.reason, observedAt: now } });
  if (match.kind === "matched") {
    await db.clusterMarket.upsert({
      where: { clusterId_marketId: { clusterId: match.clusterId, marketId: market.id } },
      create: { clusterId: match.clusterId, marketId: market.id, sourcePlatform: input.sourcePlatform, relationship: match.method, requiresInversion: match.requiresInversion ?? false },
      update: { sourcePlatform: input.sourcePlatform, relationship: match.method, requiresInversion: match.requiresInversion ?? false }
    });
  }
  return { marketId: market.id, matchedClusterId: match.kind === "matched" ? match.clusterId : null, warningCount: warnings.length };
}
