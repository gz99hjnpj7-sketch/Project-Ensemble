import { SignalConfidence } from "@prisma/client";
import type { ClusterTargetMetric } from "@/ensemble/config/clusters";
import { decideCompositePolicy, type CompositePolicyDecision } from "./policy";

export type CompositeInput = {
  marketId: string;
  sourcePlatform: string;
  question: string;
  eventTitle?: string | null;
  sourceUrl?: string | null;
  probability: number | null;
  outcomes?: Array<{ name: string; probability?: number | null }>;
  qualityScore: number;
  recencyScore: number;
  resolutionStatus: any;
  warnings: Array<{ type: string }>;
  weightOverride?: number | null;
  requiresInversion?: boolean | null;
};

export type CompositeResult = {
  compositeProbability: number | null;
  confidence: SignalConfidence;
  qualityScore: number;
  policy: CompositePolicyDecision;
  outcomeBreakdown?: Array<{ name: string; probability: number }>;
  sourceBreakdown: Array<CompositeInput & { rawProbability: number | null; displayQuestion: string; orientation: string; sourceRole: "headline" | "supporting" | "excluded"; weight: number; contribution: number | null; included: boolean; outcomeBreakdown?: Array<{ name: string; probability: number }> }>;
};

export type CompositeOptions = {
  targetMetric?: ClusterTargetMetric;
};

type WeightedInput = CompositeInput & { rawProbability: number | null; displayQuestion: string; orientation: string; weight: number };
type SpecialComposite = {
  probability: number;
  contributingIds: Set<string>;
  supportingIds: Set<string>;
  breakdown?: Array<{ name: string; probability: number }>;
};

export function computeCompositeForecast(inputs: CompositeInput[], options: CompositeOptions = {}): CompositeResult {
  const policy = decideCompositePolicy(inputs.map((input) => ({ marketId: input.marketId, probability: input.probability, qualityScore: input.qualityScore, recencyScore: input.recencyScore, resolutionStatus: input.resolutionStatus, warnings: input.warnings })));
  const includedIds = new Set(policy.includedMarketIds);
  const normalizedInputs = inputs.map((input) => standardizeInput(input, options));
  const usable = normalizedInputs.filter((input) => includedIds.has(input.marketId));
  if (!usable.length) return { compositeProbability: null, qualityScore: 0, confidence: SignalConfidence.LOW, policy, sourceBreakdown: [] };
  const weighted = usable.map((input) => ({ ...input, weight: Math.max(input.qualityScore / 100, 0.05) * Math.max(input.recencyScore / 100, 0.05) * (input.weightOverride ?? 1) }));
  const specialComposite =
    options.targetMetric === "at-least-one-fed-cut-2026" ? computeFedCutComposite(weighted)
      : options.targetMetric === "democratic-congress-control-2026" ? computeDemocraticHouseComposite(weighted)
        : options.targetMetric === "presidential-winner-2028" ? computeWinnerComposite(weighted)
          : null;
  const composite = specialComposite ?? computeDefaultComposite(weighted);
  const compositeProbability = composite.probability;
  const contributing = weighted.filter((input) => composite.contributingIds.has(input.marketId));
  const contributionWeight = contributing.reduce((sum, input) => sum + input.weight, 0);
  const qualityInputs = contributing.length ? contributing : weighted;
  const qualityWeight = qualityInputs.reduce((sum, input) => sum + input.weight, 0);
  const qualityScore = Math.round(qualityInputs.reduce((sum, input) => sum + input.qualityScore * input.weight, 0) / qualityWeight);
  return {
    compositeProbability,
    qualityScore,
    confidence: qualityScore >= 75 ? SignalConfidence.HIGH : qualityScore >= 45 ? SignalConfidence.MEDIUM : SignalConfidence.LOW,
    policy,
    outcomeBreakdown: composite.breakdown,
    sourceBreakdown: normalizedInputs.map((input) => {
      const weightedInput = weighted.find((candidate) => candidate.marketId === input.marketId);
      const weight = weightedInput?.weight ?? 0;
      const isHeadline = composite.contributingIds.has(input.marketId);
      const isSupporting = composite.supportingIds.has(input.marketId);
      return {
        ...input,
        weight,
        sourceRole: isHeadline ? "headline" : isSupporting ? "supporting" : "excluded",
        included: includedIds.has(input.marketId) && isHeadline,
        contribution: compositeProbability === null || contributionWeight <= 0 || input.probability === null || !isHeadline ? null : (input.probability * weight) / contributionWeight,
        outcomeBreakdown: options.targetMetric === "presidential-winner-2028" && weightedInput ? getNormalizedWinnerBook(weightedInput)?.breakdown : undefined
      };
    })
  };
}

function computeDefaultComposite(weighted: WeightedInput[]): SpecialComposite {
  const totalWeight = weighted.reduce((sum, input) => sum + input.weight, 0);
  return {
    probability: weighted.reduce((sum, input) => sum + (input.probability ?? 0) * input.weight, 0) / totalWeight,
    contributingIds: new Set(weighted.map((input) => input.marketId)),
    supportingIds: new Set()
  };
}

function computeFedCutComposite(weighted: WeightedInput[]): SpecialComposite | null {
  const noCutHeadlines = weighted.filter((input) => /no fed rate cuts/i.test(input.question) && typeof input.probability === "number");
  if (noCutHeadlines.length) return makeHeadlineComposite(weightedAverage(noCutHeadlines), noCutHeadlines, weighted.filter((input) => !noCutHeadlines.some((headline) => headline.marketId === input.marketId)));

  const directHeadlines = weighted.filter((input) => isFedDirectCutHeadline(input.question) && typeof input.probability === "number");
  if (directHeadlines.length) return makeHeadlineComposite(weightedAverage(directHeadlines), directHeadlines, weighted.filter((input) => !directHeadlines.some((headline) => headline.marketId === input.marketId)));

  const cutBuckets = weighted.filter(isFedCutBucket);
  if (cutBuckets.length) {
    return {
      probability: Math.min(1, cutBuckets.reduce((sum, input) => sum + (input.rawProbability ?? input.probability ?? 0), 0)),
      contributingIds: new Set(cutBuckets.map((input) => input.marketId)),
      supportingIds: new Set(weighted.filter((input) => !isFedCutBucket(input)).map((input) => input.marketId))
    };
  }

  return null;
}

function computeDemocraticHouseComposite(weighted: WeightedInput[]): SpecialComposite | null {
  const houseHeadlines = weighted.filter((input) => /party control the house after the 2026 midterm/i.test(input.question) && typeof input.probability === "number");
  if (houseHeadlines.length) return makeHeadlineComposite(weightedAverage(houseHeadlines), houseHeadlines, weighted.filter((input) => !houseHeadlines.some((headline) => headline.marketId === input.marketId)));

  const democraticHouseBuckets = weighted.filter((input) => /2026 balance of power:\s*(d|r) senate,\s*d house/i.test(input.question));
  if (democraticHouseBuckets.length) {
    return {
      probability: Math.min(1, democraticHouseBuckets.reduce((sum, input) => sum + (input.rawProbability ?? input.probability ?? 0), 0)),
      contributingIds: new Set(democraticHouseBuckets.map((input) => input.marketId)),
      supportingIds: new Set(weighted.filter((input) => !democraticHouseBuckets.some((bucket) => bucket.marketId === input.marketId)).map((input) => input.marketId))
    };
  }

  return null;
}

function makeHeadlineComposite(probability: number | null, headlineInputs: WeightedInput[], supportingInputs: WeightedInput[]): SpecialComposite | null {
  return probability === null ? null : { probability, contributingIds: new Set(headlineInputs.map((input) => input.marketId)), supportingIds: new Set(supportingInputs.map((input) => input.marketId)) };
}

function standardizeInput(input: CompositeInput, options: CompositeOptions): CompositeInput & { rawProbability: number | null; displayQuestion: string; orientation: string } {
  const rawProbability = input.probability;
  if (input.probability === null) return { ...input, rawProbability, displayQuestion: input.question, orientation: "Raw contract price" };
  const probability = input.requiresInversion ? 1 - input.probability : input.probability;
  const orientation = input.requiresInversion ? "Inverted from matched source metadata" : "Raw contract price";
  const question = input.question.toLowerCase();

  if (options.targetMetric === "at-least-one-fed-cut-2026" && /will \d+ fed rate cuts happen in 2026|will 12 or more fed rate cuts happen in 2026/.test(question)) {
    return { ...input, rawProbability, displayQuestion: "Specific Fed cut-count outcome in 2026", orientation: "Raw cut-count ladder contract" };
  }

  if (options.targetMetric === "bitcoin-upside-2026" && /all time high|hit \$?150k|reach \$?100,?000/i.test(input.question)) {
    return { ...input, rawProbability, probability, displayQuestion: "Bitcoin upside milestone in 2026", orientation };
  }

  return { ...input, rawProbability, probability, displayQuestion: input.question, orientation };
}

function weightedAverage(inputs: Array<{ probability: number | null; weight: number }>): number | null {
  const usable = inputs.filter((input): input is { probability: number; weight: number } => typeof input.probability === "number");
  const totalWeight = usable.reduce((sum, input) => sum + input.weight, 0);
  return totalWeight > 0 ? usable.reduce((sum, input) => sum + input.probability * input.weight, 0) / totalWeight : null;
}

function isFedDirectCutHeadline(question: string): boolean {
  return !/will \d+ fed rate cuts happen in 2026|will 12 or more fed rate cuts happen in 2026|no fed rate cuts/i.test(question)
    && /fed|federal reserve/i.test(question)
    && /cut/i.test(question);
}

function isFedCutBucket(input: Pick<CompositeInput, "question">): boolean {
  return /will \d+ fed rate cuts happen in 2026|will 12 or more fed rate cuts happen in 2026/i.test(input.question);
}

function computeWinnerComposite(weighted: WeightedInput[]): SpecialComposite | null {
  const books = getWinnerBooks(weighted);
  const totalWeight = books.reduce((sum, entry) => sum + entry.input.weight, 0);
  if (totalWeight <= 0) return null;

  const aggregate = new Map<string, number>();
  for (const { input, book } of books) {
    for (const outcome of book.breakdown) {
      aggregate.set(outcome.name, (aggregate.get(outcome.name) ?? 0) + outcome.probability * input.weight);
    }
  }

  const breakdown = [...aggregate.entries()]
    .map(([name, weightedProbability]) => ({ name, probability: weightedProbability / totalWeight }))
    .sort((a, b) => b.probability - a.probability);

  return breakdown[0] ? { probability: breakdown[0].probability, breakdown, contributingIds: new Set(weighted.map((input) => input.marketId)), supportingIds: new Set() } : null;
}

function getWinnerBooks(weighted: Array<CompositeInput & { rawProbability: number | null; displayQuestion: string; orientation: string; weight: number }>): Array<{ input: typeof weighted[number]; book: { breakdown: Array<{ name: string; probability: number }> } }> {
  const books: Array<{ input: typeof weighted[number]; book: { breakdown: Array<{ name: string; probability: number }> } }> = [];
  const binaryCandidates = weighted.filter(isBinaryWinnerCandidate);
  if (binaryCandidates.length) {
    const aggregate = new Map<string, number>();
    let total = 0;
    let weight = 0;
    for (const input of binaryCandidates) {
      if (typeof input.probability !== "number") continue;
      const side = canonicalWinnerSide(input.question);
      aggregate.set(side, (aggregate.get(side) ?? 0) + input.probability);
      total += input.probability;
      weight += input.weight;
    }
    if (total > 0 && weight > 0) {
      books.push({
        input: { ...binaryCandidates[0], weight: weight / binaryCandidates.length },
        book: { breakdown: [...aggregate.entries()].map(([name, probability]) => ({ name, probability: probability / total })) }
      });
    }
  }

  for (const input of weighted) {
    if (isBinaryWinnerCandidate(input)) continue;
    const book = getNormalizedWinnerBook(input);
    if (book) books.push({ input, book });
  }
  return books;
}

function getNormalizedWinnerBook(input: Pick<CompositeInput, "outcomes" | "probability" | "question">): { breakdown: Array<{ name: string; probability: number }> } | null {
  if (isBinaryWinnerCandidate(input)) {
    return typeof input.probability === "number" ? { breakdown: [{ name: canonicalWinnerSide(input.question), probability: input.probability }] } : null;
  }
  const usableOutcomes = input.outcomes?.filter((outcome): outcome is { name: string; probability: number } => typeof outcome.probability === "number" && outcome.probability > 0) ?? [];
  if (!usableOutcomes.length) {
    const side = canonicalWinnerSide(input.question);
    return typeof input.probability === "number" ? { breakdown: [{ name: side, probability: input.probability }] } : null;
  }

  const total = usableOutcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
  if (total <= 0) return null;

  const bySide = new Map<string, number>();
  for (const outcome of usableOutcomes) {
    const side = canonicalWinnerSide(outcome.name);
    bySide.set(side, (bySide.get(side) ?? 0) + outcome.probability / total);
  }
  return { breakdown: [...bySide.entries()].map(([name, probability]) => ({ name, probability })).sort((a, b) => b.probability - a.probability) };
}

function isBinaryWinnerCandidate(input: Pick<CompositeInput, "outcomes" | "question">): boolean {
  const names = input.outcomes?.map((outcome) => outcome.name.toLowerCase()).sort() ?? [];
  return names.length === 2 && names[0] === "no" && names[1] === "yes" && /win the 2028 (us )?presidential election/i.test(input.question);
}

function canonicalWinnerSide(name: string): string {
  if (/democrat|democratic|kamala|harris|michelle obama|newsom|whitmer|shapiro|buttigieg|aoc|ocasio|walz|ossoff|beshear|pritzker|wes moore|ro khanna|talarico|zohran mamdani/i.test(name)) return "Democratic";
  if (/republican|gop|trump|vance|desantis|haley|rubio|cruz|vivek|ramaswamy|abbott|youngkin|hegseth|tucker carlson|massie|tulsi gabbard/i.test(name)) return "Republican";
  return "Other";
}
