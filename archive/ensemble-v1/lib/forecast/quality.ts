import { ResolutionStatus, SignalConfidence } from "@prisma/client";
import type { NormalizedMarketInput } from "@/lib/connectors/types";

export type QualityScoreInput = Pick<
  NormalizedMarketInput,
  "liquidity" | "volume" | "bid" | "ask" | "lastUpdated" | "closeTime" | "resolutionStatus"
> & {
  createdAt?: Date | null;
};

export type QualityScoreResult = {
  score: number;
  confidence: SignalConfidence;
  flags: string[];
  liquidityScore: number;
  spreadScore: number;
  volumeScore: number;
  recencyScore: number;
  marketAgeScore: number;
};

export function computeQualityScore(input: QualityScoreInput, now = new Date()): QualityScoreResult {
  const liquidityScore = scoreLogScale(input.liquidity, 100, 100_000);
  const volumeScore = scoreLogScale(input.volume, 100, 250_000);
  const spreadScore = scoreSpread(input.bid, input.ask);
  const recencyScore = scoreRecency(input.lastUpdated, now);
  const marketAgeScore = scoreMarketAge(input.createdAt ?? null, now);
  const resolvedPenalty = input.resolutionStatus === ResolutionStatus.OPEN ? 0 : 25;

  const raw =
    liquidityScore * 0.28 +
    spreadScore * 0.24 +
    volumeScore * 0.22 +
    recencyScore * 0.18 +
    marketAgeScore * 0.08 -
    resolvedPenalty;

  const score = clamp(Math.round(raw), 0, 100);
  const flags = buildQualityFlags(input, { liquidityScore, spreadScore, volumeScore, recencyScore });

  return {
    score,
    confidence: score >= 75 ? SignalConfidence.HIGH : score >= 45 ? SignalConfidence.MEDIUM : SignalConfidence.LOW,
    flags,
    liquidityScore,
    spreadScore,
    volumeScore,
    recencyScore,
    marketAgeScore
  };
}

function scoreLogScale(value: number | null | undefined, low: number, high: number): number {
  if (!value || value <= 0) return 0;
  const numerator = Math.log10(value) - Math.log10(low);
  const denominator = Math.log10(high) - Math.log10(low);
  return clamp(Math.round((numerator / denominator) * 100), 0, 100);
}

function scoreSpread(bid: number | null | undefined, ask: number | null | undefined): number {
  if (bid === null || bid === undefined || ask === null || ask === undefined) return 45;
  const spread = Math.max(ask - bid, 0);
  if (spread <= 0.01) return 100;
  if (spread <= 0.03) return 85;
  if (spread <= 0.06) return 65;
  if (spread <= 0.1) return 40;
  return 15;
}

function scoreRecency(lastUpdated: Date, now: Date): number {
  const ageHours = Math.max((now.getTime() - lastUpdated.getTime()) / 3_600_000, 0);
  if (ageHours <= 1) return 100;
  if (ageHours <= 6) return 85;
  if (ageHours <= 24) return 65;
  if (ageHours <= 72) return 35;
  return 10;
}

function scoreMarketAge(createdAt: Date | null, now: Date): number {
  if (!createdAt) return 70;
  const ageHours = Math.max((now.getTime() - createdAt.getTime()) / 3_600_000, 0);
  if (ageHours < 2) return 45;
  if (ageHours < 24) return 70;
  return 90;
}

function buildQualityFlags(
  input: QualityScoreInput,
  scores: Pick<QualityScoreResult, "liquidityScore" | "spreadScore" | "volumeScore" | "recencyScore">
): string[] {
  const flags: string[] = [];
  if (scores.spreadScore >= 85) flags.push("tight spread");
  if (scores.liquidityScore >= 70) flags.push("high liquidity");
  if (scores.liquidityScore <= 30) flags.push("low liquidity");
  if (scores.volumeScore >= 70) flags.push("active volume");
  if (scores.recencyScore <= 35) flags.push("stale market");
  if (input.resolutionStatus !== ResolutionStatus.OPEN) flags.push("not open");
  return flags;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
