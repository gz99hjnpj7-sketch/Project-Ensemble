import type { PrismaClient, SignalConfidence } from "@prisma/client";
import type { CompositeResult } from "@/lib/forecast/composite";

export type ForecastCurrentPayload = {
  clusterId: string;
  compositeValue: number | null;
  confidence: SignalConfidence;
  confidenceScore: number;
  marketCount: number;
  warningCount: number;
  move24h: number | null;
  sourceBreakdown: unknown;
  processedAt: Date;
};

export function buildForecastCurrentPayload(input: {
  clusterId: string;
  composite: CompositeResult;
  marketCount: number;
  warningCount: number;
  move24h: number | null;
  processedAt: Date;
}): ForecastCurrentPayload {
  return {
    clusterId: input.clusterId,
    compositeValue: input.composite.compositeProbability,
    confidence: input.composite.confidence,
    confidenceScore: input.composite.qualityScore,
    marketCount: input.marketCount,
    warningCount: input.warningCount,
    move24h: input.move24h,
    sourceBreakdown: input.composite.sourceBreakdown,
    processedAt: input.processedAt
  };
}

export async function writeForecastCurrent(db: PrismaClient, payload: ForecastCurrentPayload): Promise<void> {
  await db.forecastCurrent.upsert({
    where: { clusterId: payload.clusterId },
    create: {
      clusterId: payload.clusterId,
      compositeValue: payload.compositeValue,
      confidence: payload.confidence,
      confidenceScore: payload.confidenceScore,
      marketCount: payload.marketCount,
      warningCount: payload.warningCount,
      move24h: payload.move24h,
      sourceBreakdown: payload.sourceBreakdown as object,
      processedAt: payload.processedAt
    },
    update: {
      compositeValue: payload.compositeValue,
      confidence: payload.confidence,
      confidenceScore: payload.confidenceScore,
      marketCount: payload.marketCount,
      warningCount: payload.warningCount,
      move24h: payload.move24h,
      sourceBreakdown: payload.sourceBreakdown as object,
      processedAt: payload.processedAt
    }
  });
}
