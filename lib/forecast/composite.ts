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
    input.qualityScore >= 30
  );
  if (usable.length === 0) {
    return {
      compositeProbability: null,
      qualityScore: 0,
      confidence: SignalConfidence.LOW,
      sourceBreakdown: []
    };
  }

  // 1. Handle Inverse Tokens (e.g. "will hit X" vs "will stay under X")
  const normalized = usable.map(input => {
    let prob = input.probability!;
    // Detect common inverse patterns
    const q = input.question.toLowerCase();
    if (/stay under|below|not (win|hit|exceed)|fail|no (success|launch)/.test(q)) {
      prob = 1 - prob; // Invert
    }
    return { ...input, probability: prob };
  });

  // 2. Group by semantic outcome for categorical/multi-choice (normalize to avoid summing >1)
  const groups = new Map<string, typeof normalized>();
  normalized.forEach(input => {
    // Simple key by stripping common prefixes/suffixes to group "who wins"
    const key = input.question.replace(/will |win the |nominee|hit |by |in |before \d+/gi, "").trim().toLowerCase().slice(0, 40);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(input);
  });

  const weighted = Array.from(groups.values()).flatMap(group => {
    if (group.length > 1) {
      // For categorical group: normalize probs to sum ~1 (or use max for mutually exclusive)
      const sumP = group.reduce((s, i) => s + (i.probability || 0), 0);
      if (sumP > 0) {
        group.forEach(i => i.probability = (i.probability || 0) / sumP);
      }
    }
    return group.map(input => {
      const manualWeight = input.weightOverride ?? 1;
      const weight = Math.max(input.qualityScore / 100, 0.05) * Math.max(input.recencyScore / 100, 0.05) * manualWeight;
      return { ...input, weight };
    });
  });

  const totalWeight = weighted.reduce((sum, input) => sum + input.weight, 0);

  // 3. Conditional aggregation with fixes
  const isMutuallyExclusive = weighted.length > 2 &&
    weighted.some(i => /win the|nominee|nomination|presidential|who will|which (company|team|person)/i.test(i.question));

  let compositeProbability: number | null;
  if (isMutuallyExclusive) {
    compositeProbability = Math.max(...weighted.map(i => i.probability ?? 0));
  } else {
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
