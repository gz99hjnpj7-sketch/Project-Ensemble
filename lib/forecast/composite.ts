import { SignalConfidence } from "@prisma/client";

export type CompositeInput = {
  marketId: string;
  sourcePlatform: string;
  question: string;
  probability: number | null;
  qualityScore: number;
  recencyScore: number;
  weightOverride?: number | null;
};

export type CompositeResult = {
  compositeProbability: number | null;
  confidence: SignalConfidence;
  qualityScore: number;
  sourceBreakdown: Array<CompositeInput & { weight: number; contribution: number | null }>;
};

export function computeCompositeForecast(inputs: CompositeInput[]): CompositeResult {
  const usable = inputs.filter((input) => 
    input.probability !== null &&
    input.qualityScore >= 30 // basic quality floor
  );
  if (usable.length === 0) {
    return {
      compositeProbability: null,
      qualityScore: 0,
      confidence: SignalConfidence.LOW,
      sourceBreakdown: []
    };
  }

  const weighted = usable.map((input) => {
    const manualWeight = input.weightOverride ?? 1;
    const weight = Math.max(input.qualityScore / 100, 0.05) * Math.max(input.recencyScore / 100, 0.05) * manualWeight;
    return { ...input, weight };
  });
  const totalWeight = weighted.reduce((sum, input) => sum + input.weight, 0);

  // === CONDITIONAL AGGREGATION (Math fix for user trust) ===
  // Detect mutually exclusive election-style markets (many "Will X win/nominee" for same race)
  const isMutuallyExclusive = usable.length > 3 &&
    usable.some(i => /win the|nominee|nomination|presidential election/i.test(i.question));

  let compositeProbability: number | null;
  if (isMutuallyExclusive) {
    // For winner/nominee races: use the frontrunner's (highest) probability
    // (instead of averaging 60+ long-shots down to ~1%)
    compositeProbability = Math.max(...usable.map(i => i.probability ?? 0));
  } else {
    // Binary / independent macro events: volume/quality weighted average
    compositeProbability =
      totalWeight > 0
        ? weighted.reduce((sum, input) => sum + (input.probability ?? 0) * input.weight, 0) / totalWeight
        : null;
  }

  const qualityScore = weighted.length
    ? Math.round(weighted.reduce((sum, input) => sum + input.qualityScore * input.weight, 0) / totalWeight)
    : 0;

  return {
    compositeProbability,
    qualityScore,
    confidence: qualityScore >= 75 ? SignalConfidence.HIGH : qualityScore >= 45 ? SignalConfidence.MEDIUM : SignalConfidence.LOW,
    sourceBreakdown: weighted.map((input) => ({
      ...input,
      contribution:
        compositeProbability === null || totalWeight <= 0 || input.probability === null
          ? null
          : (input.probability * input.weight) / totalWeight
    }))
  };
}
