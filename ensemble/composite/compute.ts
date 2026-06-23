import { SignalConfidence } from "@prisma/client";
import { decideCompositePolicy, type CompositePolicyDecision } from "./policy";

export type CompositeInput = {
  marketId: string;
  sourcePlatform: string;
  question: string;
  probability: number | null;
  qualityScore: number;
  recencyScore: number;
  resolutionStatus: any;
  warnings: Array<{ type: string }>;
  weightOverride?: number | null;
};

export type CompositeResult = {
  compositeProbability: number | null;
  confidence: SignalConfidence;
  qualityScore: number;
  policy: CompositePolicyDecision;
  sourceBreakdown: Array<CompositeInput & { rawProbability: number | null; displayQuestion: string; orientation: string; weight: number; contribution: number | null; included: boolean }>;
};

export function computeCompositeForecast(inputs: CompositeInput[]): CompositeResult {
  const policy = decideCompositePolicy(inputs.map((input) => ({ marketId: input.marketId, probability: input.probability, qualityScore: input.qualityScore, recencyScore: input.recencyScore, resolutionStatus: input.resolutionStatus, warnings: input.warnings })));
  const includedIds = new Set(policy.includedMarketIds);
  const normalizedInputs = inputs.map(standardizeInput);
  const usable = normalizedInputs.filter((input) => includedIds.has(input.marketId));
  if (!usable.length) return { compositeProbability: null, qualityScore: 0, confidence: SignalConfidence.LOW, policy, sourceBreakdown: [] };
  const weighted = usable.map((input) => ({ ...input, weight: Math.max(input.qualityScore / 100, 0.05) * Math.max(input.recencyScore / 100, 0.05) * (input.weightOverride ?? 1) }));
  const totalWeight = weighted.reduce((sum, input) => sum + input.weight, 0);
  const isMutuallyExclusive = usable.length > 3 && usable.some((input) => /win the|nominee|nomination|presidential election/i.test(input.question));
  const compositeProbability = isMutuallyExclusive ? Math.max(...usable.map((input) => input.probability ?? 0)) : weighted.reduce((sum, input) => sum + (input.probability ?? 0) * input.weight, 0) / totalWeight;
  const qualityScore = Math.round(weighted.reduce((sum, input) => sum + input.qualityScore * input.weight, 0) / totalWeight);
  return {
    compositeProbability,
    qualityScore,
    confidence: qualityScore >= 75 ? SignalConfidence.HIGH : qualityScore >= 45 ? SignalConfidence.MEDIUM : SignalConfidence.LOW,
    policy,
    sourceBreakdown: normalizedInputs.map((input) => {
      const weightedInput = weighted.find((candidate) => candidate.marketId === input.marketId);
      const weight = weightedInput?.weight ?? 0;
      return { ...input, weight, included: includedIds.has(input.marketId), contribution: compositeProbability === null || totalWeight <= 0 || input.probability === null || !includedIds.has(input.marketId) ? null : (input.probability * weight) / totalWeight };
    })
  };
}

function standardizeInput(input: CompositeInput): CompositeInput & { rawProbability: number | null; displayQuestion: string; orientation: string } {
  const rawProbability = input.probability;
  if (input.probability === null) return { ...input, rawProbability, displayQuestion: input.question, orientation: "Raw contract price" };
  const question = input.question.toLowerCase();
  if (question.includes("no fed rate cuts")) {
    return { ...input, rawProbability, probability: 1 - input.probability, displayQuestion: "At least one Fed rate cut in 2026", orientation: "Inverted from raw No-cuts contract" };
  }
  if (question.includes("republican party control the house after the 2026")) {
    return { ...input, rawProbability, probability: 1 - input.probability, displayQuestion: "Democratic control of the House after 2026 midterms", orientation: "Inverted from Republican House-control contract" };
  }
  if (question.includes("democratic party control the house after the 2026")) {
    return { ...input, rawProbability, displayQuestion: "Democratic control of the House after 2026 midterms", orientation: "Raw Democratic House-control contract" };
  }
  return { ...input, rawProbability, displayQuestion: input.question, orientation: "Raw contract price" };
}
