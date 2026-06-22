import { ResolutionStatus, WarningType } from "@prisma/client";

export type CompositePolicyDecision = {
  includedMarketIds: string[];
  excludedSources: Array<{ marketId: string; reason: "missing_probability" | "low_quality" | "anomaly" | "stale" | "closed" }>;
  confidenceBand: "tight" | "normal" | "wide";
  flags: string[];
};

export type CompositePolicyInput = {
  marketId: string;
  probability: number | null;
  qualityScore: number;
  recencyScore: number;
  resolutionStatus: ResolutionStatus;
  warnings: Array<{ type: WarningType | string }>;
};

export function decideCompositePolicy(inputs: CompositePolicyInput[]): CompositePolicyDecision {
  const includedMarketIds: string[] = [];
  const excludedSources: CompositePolicyDecision["excludedSources"] = [];
  const flags = new Set<string>();
  for (const input of inputs) {
    const warningTypes = input.warnings.map((warning) => String(warning.type));
    if (input.probability === null || input.probability === undefined) excludedSources.push({ marketId: input.marketId, reason: "missing_probability" });
    else if (input.resolutionStatus !== ResolutionStatus.OPEN) excludedSources.push({ marketId: input.marketId, reason: "closed" });
    else if (input.qualityScore < 30) excludedSources.push({ marketId: input.marketId, reason: "low_quality" });
    else if (warningTypes.includes(WarningType.STALE_MARKET) && input.recencyScore <= 35) excludedSources.push({ marketId: input.marketId, reason: "stale" });
    else {
      if (warningTypes.length) flags.add("source warnings present");
      if (input.qualityScore < 45) flags.add("low confidence source included");
      includedMarketIds.push(input.marketId);
    }
  }
  const anomalyCount = inputs.filter((input) => input.warnings.length > 0).length;
  const confidenceBand = anomalyCount >= 2 || excludedSources.length >= 2 ? "wide" : anomalyCount === 1 ? "normal" : "tight";
  return { includedMarketIds, excludedSources, confidenceBand, flags: [...flags] };
}
